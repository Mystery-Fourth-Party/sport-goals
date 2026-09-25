// Reprogrammation du rappel quotidien au changement de jour. Un objectif se
// clôt avec le seul passage du temps (isGoalClosed), sans que `goals` ni les
// réglages ne changent : ce fichier vérifie qu'un retour au premier plan le
// lendemain d'une échéance retire l'objectif clos des rappels programmés.
// Contrairement à ReminderScheduler.test.tsx, il fait tourner le vrai
// rescheduleDailyReminder et n'observe que les appels à expo-notifications.
import { act, render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import ReminderScheduler from './ReminderScheduler';
import { ReminderStatusProvider } from './reminder-status';
import { DEFAULT_SETTINGS, Settings } from './settingsStorage';
import { Goal } from './types';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
}));

// Même dispositif que ReminderScheduler.test.tsx : seuls les objectifs et
// les réglages sont fournis, pas leur chargement depuis AsyncStorage.
let mockGoals: Goal[] = [];
const mockSettings: Settings = { ...DEFAULT_SETTINGS, dailyReminder: true, reminderTime: '20:00' };

jest.mock('./goals-context', () => ({
  useGoals: () => ({ goals: mockGoals, loaded: true }),
}));
jest.mock('./settings-context', () => ({
  useSettings: () => ({ settings: mockSettings, loaded: true }),
}));

const mockedSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockedCancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;

// Capture les gestionnaires AppState pour simuler un retour au premier plan
// (même procédé que useToday.test.tsx). Une liste et non un seul
// gestionnaire : sans abonné, l'évènement ne touche personne, comme sur
// l'appareil, au lieu de faire planter le test.
function captureAppStateHandler() {
  const handlers: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
    if (event === 'change') handlers.push(cb as (state: AppStateStatus) => void);
    return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
  });
  return {
    fire: (state: AppStateStatus) => act(() => handlers.forEach((handler) => handler(state))),
  };
}

function scheduledTimes(): string[] {
  return mockedSchedule.mock.calls.map(([request]) => {
    const { hour, minute } = request.trigger;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  });
}

// Échéance le 25/09 (midi local), horaire personnalisé 07:30, aucune
// séance : l'objectif est rappelé jusqu'au 25 inclus, plus à partir du 26.
function goalDueOn25th(): Goal {
  return {
    id: 'due',
    title: 'Échéance le 25',
    targetValue: 100,
    unit: 'reps',
    createdAt: new Date(2026, 8, 1, 12).toISOString(),
    deadline: new Date(2026, 8, 25, 12).toISOString(),
    entries: [],
    reminderTime: '07:30',
  };
}

async function mountOnDeadlineDay() {
  jest.setSystemTime(new Date(2026, 8, 25, 20, 0));
  const appState = captureAppStateHandler();
  render(
    <ReminderStatusProvider>
      <ReminderScheduler />
    </ReminderStatusProvider>,
  );
  await waitFor(() => expect(mockedCancelAll).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(scheduledTimes()).toContain('07:30'));
  return appState;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockedSchedule.mockClear();
  mockedCancelAll.mockClear();
  mockGoals = [goalDueOn25th()];
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ReminderScheduler — changement de jour', () => {
  it("retire des rappels un objectif clos au retour au premier plan le lendemain de l'échéance", async () => {
    const appState = await mountOnDeadlineDay();
    mockedSchedule.mockClear();

    jest.setSystemTime(new Date(2026, 8, 26, 8, 0));
    appState.fire('active');

    await waitFor(() => expect(mockedCancelAll).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(scheduledTimes()).toEqual(['20:00']));
  });

  // Garde-fou, vert avant comme après le correctif : il ne prouve pas la
  // reprogrammation au changement de jour, il empêche qu'un correctif
  // reprogramme à chaque retour au premier plan.
  it('ne reprogramme pas au retour au premier plan quand le jour est resté le même', async () => {
    const appState = await mountOnDeadlineDay();
    const scheduledBefore = mockedSchedule.mock.calls.length;

    jest.setSystemTime(new Date(2026, 8, 25, 23, 0));
    appState.fire('active');
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(mockedCancelAll).toHaveBeenCalledTimes(1);
    expect(mockedSchedule.mock.calls.length).toBe(scheduledBefore);
  });
});
