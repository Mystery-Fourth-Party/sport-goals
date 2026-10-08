// Répétition automatique vue de GoalsProvider : quand une occurrence qui répète
// est close, l'app ouverte crée l'occurrence suivante, une seule par série, avec
// le relais de la coche, en une seule écriture. Couvre le moment (chargement,
// retour au premier plan, import), l'unicité, l'arrêt et les gardes de lecture.
// Ne couvre pas la coche des formulaires ni le calcul pur de src/series.ts.
import { ReactNode, StrictMode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { GoalsProvider, useGoals } from './goals-context';
import { sendGoalReachedNotification } from './notifications';
import { SettingsProvider } from './settings-context';
import { dateStr, getGoalStats } from './stats';
import { loadGoals, saveGoals } from './storage';
import { StorageStatusProvider } from './storage-status';
import { Goal } from './types';

jest.mock('./notifications', () => ({
  sendGoalReachedNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./storage', () => {
  const actual = jest.requireActual('./storage');
  return { ...actual, loadGoals: jest.fn(), saveGoals: jest.fn() };
});

const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;
const mockedSendGoalReached = sendGoalReachedNotification as jest.Mock;

// Heure locale et non UTC : les jours de ces tests sont des jours locaux, ils
// doivent donc tomber au même endroit sous les quatre fuseaux de la suite.
const OCT_15 = () => new Date(2026, 9, 15, 12, 0);

// Occurrence de 30 jours (14/09 → 14/10), close le 15/10 : la durée totale
// traverse la fin de l'heure d'été européenne (25/10) pour la suivante.
function occurrence(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'tip',
    title: 'Courir 100 km',
    targetValue: 100,
    unit: 'km',
    createdAt: new Date(2026, 8, 14, 12).toISOString(),
    deadline: new Date(2026, 9, 14, 12).toISOString(),
    entries: [{ date: '2026-09-20', value: 40 }],
    reminderEnabled: true,
    reminderTime: '07:30',
    remindAfterReached: true,
    repeat: true,
    seriesId: 's1',
    ...overrides,
  };
}

function Plain({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>{children}</GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

function Strict({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <Plain>{children}</Plain>
    </StrictMode>
  );
}

// Capture les abonnements AppState (celui de useToday, dans le provider) pour
// simuler un retour au premier plan sans cycle de vie réel.
function captureAppState() {
  const handlers: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
    if (event === 'change') handlers.push(cb as (state: AppStateStatus) => void);
    return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
  });
  return {
    foreground: () => act(() => handlers.forEach((handler) => handler('active'))),
  };
}

interface MountOptions {
  readOk?: boolean;
  strict?: boolean;
}

async function mount(goals: Goal[], { readOk = true, strict = false }: MountOptions = {}) {
  mockedLoadGoals.mockResolvedValue({ value: goals, ok: readOk });
  const appState = captureAppState();
  const view = renderHook(() => useGoals(), { wrapper: strict ? Strict : Plain });
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  await act(async () => {});
  return { ...view, appState };
}

function byId(goals: Goal[], id: string): Goal {
  const found = goals.find((g) => g.id === id);
  if (!found) throw new Error(`objectif ${id} introuvable`);
  return found;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedLoadGoals.mockReset();
  mockedSaveGoals.mockReset().mockResolvedValue(true);
  mockedSendGoalReached.mockClear();
  jest.useFakeTimers();
  jest.setSystemTime(OCT_15());
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('création de l’occurrence suivante', () => {
  it('creates the next occurrence of a closed repeating goal once the goals are loaded', async () => {
    const { result } = await mount([occurrence()]);

    expect(result.current.goals).toHaveLength(2);
    const next = result.current.goals.find((g) => g.id !== 'tip')!;
    expect(next.title).toBe('Courir 100 km');
    expect(next.targetValue).toBe(100);
    expect(next.unit).toBe('km');
    expect(next.reminderEnabled).toBe(true);
    expect(next.reminderTime).toBe('07:30');
    expect(next.remindAfterReached).toBe(true);
    expect(next.entries).toEqual([]);
    expect(next.createdAt).toBe(OCT_15().toISOString());
    expect(next.seriesId).toBe('s1');
    expect(next.repeat).toBe(true);
  });

  // Le relais : la coche quitte l'ancienne, c'est ce qui empêche de recréer.
  it('hands the repeat flag over from the closed occurrence to the new one', async () => {
    const { result } = await mount([occurrence()]);

    expect(byId(result.current.goals, 'tip').repeat).toBe(false);
    expect(byId(result.current.goals, 'tip').seriesId).toBe('s1');
  });

  it('writes the new occurrence and the handover in one single save', async () => {
    await mount([occurrence()]);

    expect(mockedSaveGoals).toHaveBeenCalledTimes(1);
    const saved: Goal[] = mockedSaveGoals.mock.calls[0][0];
    expect(saved).toHaveLength(2);
    expect(saved.filter((g) => g.repeat === true)).toHaveLength(1);
    expect(byId(saved, 'tip').repeat).toBe(false);
  });

  // Jour local et non instant : +30 jours traverse la fin de l'heure d'été
  // (25/10 à Paris, 01/11 à New York), et la durée doit rester celle d'origine.
  it('keeps the total duration across a clock change, compared in local days', async () => {
    const { result } = await mount([occurrence()]);

    const next = result.current.goals.find((g) => g.id !== 'tip')!;
    expect(dateStr(new Date(next.deadline))).toBe('2026-11-14');
    expect(getGoalStats(next, '2026-10-15').totalDays).toBe(30);
  });

  it('does not announce an objective reached for the new occurrence', async () => {
    await mount([occurrence()]);

    expect(mockedSendGoalReached).not.toHaveBeenCalled();
  });

  it('creates a single occurrence after a long absence, starting on the reopening day', async () => {
    jest.setSystemTime(new Date(2027, 0, 12, 9, 0));

    const { result } = await mount([occurrence()]);

    expect(result.current.goals).toHaveLength(2);
    const next = result.current.goals.find((g) => g.id !== 'tip')!;
    expect(next.createdAt).toBe(new Date(2027, 0, 12, 9, 0).toISOString());
    expect(dateStr(new Date(next.deadline))).toBe('2027-02-11');
  });

  it('creates nothing while the goal still runs, then creates it when the day changes', async () => {
    jest.setSystemTime(new Date(2026, 9, 14, 20, 0));
    const { result, appState } = await mount([occurrence()]);
    expect(result.current.goals).toHaveLength(1);

    jest.setSystemTime(new Date(2026, 9, 15, 8, 0));
    appState.foreground();
    await waitFor(() => expect(result.current.goals).toHaveLength(2));

    expect(mockedSaveGoals).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the goal still runs', occurrence({ deadline: new Date(2026, 9, 20, 12).toISOString() })],
    ['repeat is switched off', occurrence({ repeat: false })],
    ['repeat is absent', occurrence({ repeat: undefined })],
    ['there is no seriesId', occurrence({ seriesId: undefined })],
  ])('creates nothing when %s', async (_label, goal) => {
    const { result } = await mount([goal]);

    expect(result.current.goals).toHaveLength(1);
    expect(mockedSaveGoals).not.toHaveBeenCalled();
  });
});

describe('garde de lecture', () => {
  it('creates and writes nothing while the goals could not be read', async () => {
    const { result } = await mount([occurrence()], { readOk: false });

    expect(result.current.goals).toHaveLength(1);
    expect(mockedSaveGoals).not.toHaveBeenCalled();
  });
});

describe('idempotence', () => {
  it('creates exactly one occurrence under StrictMode and repeated foregrounding the same day', async () => {
    const { result, appState } = await mount([occurrence()], { strict: true });

    appState.foreground();
    appState.foreground();
    await act(async () => {});

    expect(result.current.goals).toHaveLength(2);
    expect(mockedSaveGoals).toHaveBeenCalledTimes(1);
  });
});

describe('une seule occurrence par série', () => {
  it('creates one occurrence from the latest one when several of the series repeat', async () => {
    const older = occurrence({
      id: 'older',
      title: 'Ancienne',
      createdAt: new Date(2026, 7, 1, 12).toISOString(),
      deadline: new Date(2026, 7, 31, 12).toISOString(),
    });

    const { result } = await mount([older, occurrence({ title: 'Récente' })]);

    expect(result.current.goals).toHaveLength(3);
    const next = result.current.goals.find((g) => g.id !== 'tip' && g.id !== 'older')!;
    expect(next.title).toBe('Récente');
    expect(result.current.goals.filter((g) => g.repeat === true)).toEqual([next]);
  });

  it('ignores an older repeating occurrence while the latest of the series still runs', async () => {
    const older = occurrence({
      id: 'older',
      createdAt: new Date(2026, 7, 1, 12).toISOString(),
      deadline: new Date(2026, 7, 31, 12).toISOString(),
    });
    const running = occurrence({
      id: 'running',
      createdAt: new Date(2026, 9, 10, 12).toISOString(),
      deadline: new Date(2026, 10, 10, 12).toISOString(),
    });

    const { result } = await mount([older, running]);

    expect(result.current.goals).toHaveLength(2);
    expect(mockedSaveGoals).not.toHaveBeenCalled();
  });

  it('creates one occurrence per series', async () => {
    const other = occurrence({ id: 'other-tip', title: 'Nager', seriesId: 's2' });

    const { result } = await mount([occurrence(), other]);

    expect(result.current.goals).toHaveLength(4);
    expect(
      result.current.goals
        .filter((g) => g.repeat === true)
        .map((g) => g.seriesId)
        .sort(),
    ).toEqual(['s1', 's2']);
  });
});

describe('arrêt de la série', () => {
  const running = () =>
    occurrence({
      createdAt: new Date(2026, 9, 5, 12).toISOString(),
      deadline: new Date(2026, 10, 4, 12).toISOString(),
    });

  it('stops creating once repeat is switched off on the current occurrence', async () => {
    const { result, appState } = await mount([running()]);

    act(() => result.current.updateGoal('tip', { repeat: false }));
    jest.setSystemTime(new Date(2026, 10, 6, 9, 0));
    appState.foreground();
    await act(async () => {});

    expect(result.current.goals).toHaveLength(1);
  });

  it('stops creating once the current occurrence is deleted', async () => {
    const previous = occurrence({
      id: 'previous',
      repeat: false,
      createdAt: new Date(2026, 7, 5, 12).toISOString(),
      deadline: new Date(2026, 8, 4, 12).toISOString(),
    });
    const { result, appState } = await mount([running(), previous]);

    act(() => result.current.deleteGoal('tip'));
    jest.setSystemTime(new Date(2026, 10, 6, 9, 0));
    appState.foreground();
    await act(async () => {});

    expect(result.current.goals.map((g) => g.id)).toEqual(['previous']);
  });

  // Import incohérent : deux occurrences de la même série portent repeat.
  // Supprimer la pointe ne doit pas faire de l'ancienne la nouvelle pointe
  // avec sa coche : la série s'arrête, comme la spec le dit.
  it('does not restart the series from an older repeating occurrence when the current one is deleted', async () => {
    const older = occurrence({
      id: 'older',
      createdAt: new Date(2026, 7, 1, 12).toISOString(),
      deadline: new Date(2026, 7, 31, 12).toISOString(),
    });
    const { result, appState } = await mount([older, running()]);

    act(() => result.current.deleteGoal('tip'));
    await act(async () => {});
    jest.setSystemTime(new Date(2026, 10, 6, 9, 0));
    appState.foreground();
    await act(async () => {});

    expect(result.current.goals.map((g) => g.id)).toEqual(['older']);
    expect(byId(result.current.goals, 'older').repeat).toBe(false);
  });

  it('keeps the series going when an archived occurrence is deleted', async () => {
    const archived = occurrence({
      id: 'archived',
      repeat: false,
      createdAt: new Date(2026, 7, 5, 12).toISOString(),
      deadline: new Date(2026, 8, 4, 12).toISOString(),
    });
    const { result, appState } = await mount([running(), archived]);

    act(() => result.current.deleteGoal('archived'));
    jest.setSystemTime(new Date(2026, 10, 6, 9, 0));
    appState.foreground();
    await waitFor(() => expect(result.current.goals).toHaveLength(2));

    expect(byId(result.current.goals, 'tip').repeat).toBe(false);
  });
});

describe('import d’une sauvegarde', () => {
  it('creates one occurrence per expired series after replaceAllGoals', async () => {
    const { result } = await mount([]);

    act(() =>
      result.current.replaceAllGoals([occurrence(), occurrence({ id: 'b', seriesId: 's2' })]),
    );
    await waitFor(() => expect(result.current.goals).toHaveLength(4));

    expect(result.current.goals.filter((g) => g.repeat === true)).toHaveLength(2);
    const lastSaved: Goal[] = mockedSaveGoals.mock.calls.at(-1)![0];
    expect(lastSaved).toHaveLength(4);
  });

  it('creates the occurrence once the import has cleared a failed read', async () => {
    const { result } = await mount([], { readOk: false });

    act(() => result.current.replaceAllGoals([occurrence()]));
    await waitFor(() => expect(result.current.goals).toHaveLength(2));
  });
});
