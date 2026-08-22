import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { GoalsProvider, useGoals } from './goals-context';
import { sendGoalReachedNotification } from './notifications';
import { SettingsProvider, useSettings } from './settings-context';
import { todayStr } from './stats';
import { Goal } from './types';

// sendGoalReachedNotification touches expo-notifications' native module, which
// has nothing real to talk to under jest — mocked so these tests only assert
// *when* goals-context decides to call it, not what it does internally
// (already covered separately by notifications.test.ts's pure-logic tests).
// jest.mock calls are hoisted above imports by babel-jest, so this is safe
// even though it reads as coming "after" the import above.
jest.mock('./notifications', () => ({
  sendGoalReachedNotification: jest.fn(),
}));

const mockedSendGoalReachedNotification = sendGoalReachedNotification as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <GoalsProvider>{children}</GoalsProvider>
    </SettingsProvider>
  );
}

// Expose both contexts from one hook so a test can flip a setting
// (goalReachedNotifs) and then drive goals from the same render.
function useHarness() {
  return { goals: useGoals(), settings: useSettings() };
}

// Attend le chargement des *deux* providers avant de rendre la main à un
// test : goals et settings se chargent en parallèle depuis AsyncStorage
// (deux effets indépendants), donc n'attendre que goals.loaded laisserait
// une fenêtre où un updateSettings() appelé juste après serait écrasé par
// la résolution tardive du chargement initial des settings.
async function renderHarness() {
  const view = renderHook(() => useHarness(), { wrapper });
  await waitFor(() => {
    expect(view.result.current.goals.loaded).toBe(true);
    expect(view.result.current.settings.loaded).toBe(true);
  });
  return view;
}

const baseGoal: Goal = {
  id: 'g1',
  title: 'Test goal',
  targetValue: 100,
  unit: 'reps',
  createdAt: '2026-08-01T00:00:00.000Z',
  deadline: '2026-08-31T00:00:00.000Z',
  entries: [
    { date: '2026-08-10', value: 20 },
    { date: '2026-08-11', value: 0 },
  ],
};

// Le mock AsyncStorage est un magasin en mémoire partagé entre les tests
// (module-level) : sans le vider, un test qui persiste des goals/settings
// pollue le chargement initial du suivant.
beforeEach(async () => {
  await AsyncStorage.clear();
  mockedSendGoalReachedNotification.mockClear();
});

describe('updateEntry', () => {
  it('replaces the value of an existing entry instead of adding to it', async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.updateEntry('g1', '2026-08-10', 55));

    const entry = result.current.goals.goals[0].entries.find((e) => e.date === '2026-08-10');
    expect(entry?.value).toBe(55);
  });

  it('can turn a 0-value entry into a real one', async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.updateEntry('g1', '2026-08-11', 12));

    const entry = result.current.goals.goals[0].entries.find((e) => e.date === '2026-08-11');
    expect(entry?.value).toBe(12);
  });

  it('rejects newValue <= 0 in the context itself, not just the UI', async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.updateEntry('g1', '2026-08-10', 0));
    act(() => result.current.goals.updateEntry('g1', '2026-08-10', -5));

    const entry = result.current.goals.goals[0].entries.find((e) => e.date === '2026-08-10');
    expect(entry?.value).toBe(20);
  });

  it('is a no-op for an unknown goal id or date', async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.updateEntry('does-not-exist', '2026-08-10', 5));
    act(() => result.current.goals.updateEntry('g1', '2026-08-09', 5));

    expect(result.current.goals.goals[0].entries).toEqual(baseGoal.entries);
  });

  it('never sends a notification, even when the edit completes the goal', async () => {
    const { result } = await renderHarness();
    act(() => result.current.settings.updateSettings({ goalReachedNotifs: true }));

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.updateEntry('g1', '2026-08-10', 100));

    expect(result.current.goals.goals[0].entries.find((e) => e.date === '2026-08-10')?.value).toBe(
      100,
    );
    expect(mockedSendGoalReachedNotification).not.toHaveBeenCalled();
  });
});

describe('deleteEntry', () => {
  it('removes the entry for that date, distinct from setting it to 0', async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.deleteEntry('g1', '2026-08-10'));

    const entries = result.current.goals.goals[0].entries;
    expect(entries.find((e) => e.date === '2026-08-10')).toBeUndefined();
    // L'entrée à 0 (autre date) n'est pas affectée par la suppression de l'autre.
    expect(entries.find((e) => e.date === '2026-08-11')).toEqual({
      date: '2026-08-11',
      value: 0,
    });
  });

  it('is a no-op for an unknown goal id or date', async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.deleteEntry('does-not-exist', '2026-08-10'));
    act(() => result.current.goals.deleteEntry('g1', '2099-01-01'));

    expect(result.current.goals.goals[0].entries).toEqual(baseGoal.entries);
  });

  it('never sends a notification', async () => {
    const { result } = await renderHarness();
    act(() => result.current.settings.updateSettings({ goalReachedNotifs: true }));

    act(() => result.current.goals.createGoal(baseGoal));
    act(() => result.current.goals.deleteEntry('g1', '2026-08-10'));

    expect(mockedSendGoalReachedNotification).not.toHaveBeenCalled();
  });
});

describe('addProgress', () => {
  const emptyGoal: Goal = {
    id: 'g2',
    title: 'Fresh goal',
    targetValue: 30,
    unit: 'reps',
    createdAt: '2026-08-01T00:00:00.000Z',
    deadline: '2026-08-31T00:00:00.000Z',
    entries: [],
  };

  it("sums into today's entry rather than creating a second one", async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal(emptyGoal));
    act(() => result.current.goals.addProgress('g2', 5));
    act(() => result.current.goals.addProgress('g2', 7));

    const entries = result.current.goals.goals[0].entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].value).toBe(12);
  });

  it('notifies exactly once, at the moment the goal transitions to completed', async () => {
    const { result } = await renderHarness();
    act(() => result.current.settings.updateSettings({ goalReachedNotifs: true }));

    act(() => result.current.goals.createGoal(emptyGoal));
    act(() => result.current.goals.addProgress('g2', 20)); // 20/30 : pas encore complété
    expect(mockedSendGoalReachedNotification).not.toHaveBeenCalled();

    act(() => result.current.goals.addProgress('g2', 10)); // 30/30 : bascule à "completed"
    expect(mockedSendGoalReachedNotification).toHaveBeenCalledTimes(1);
    expect(mockedSendGoalReachedNotification).toHaveBeenCalledWith('Fresh goal');

    act(() => result.current.goals.addProgress('g2', 5)); // déjà complété : pas de re-notification
    expect(mockedSendGoalReachedNotification).toHaveBeenCalledTimes(1);
  });

  it('does not notify when goalReachedNotifs is off (the default)', async () => {
    const { result } = await renderHarness();
    expect(result.current.settings.settings.goalReachedNotifs).toBe(false);

    act(() => result.current.goals.createGoal(emptyGoal));
    act(() => result.current.goals.addProgress('g2', 30)); // complète l'objectif

    expect(mockedSendGoalReachedNotification).not.toHaveBeenCalled();
  });

  it('loses nothing and notifies exactly once on a double-tap (two calls before any re-render)', async () => {
    const { result } = await renderHarness();
    act(() => result.current.settings.updateSettings({ goalReachedNotifs: true }));

    const almostThere: Goal = {
      id: 'g3',
      title: 'Double-tap goal',
      targetValue: 30,
      unit: 'reps',
      createdAt: '2026-08-01T00:00:00.000Z',
      deadline: '2026-08-31T00:00:00.000Z',
      entries: [{ date: '2026-08-10', value: 20 }],
    };
    act(() => result.current.goals.createGoal(almostThere));

    // Les deux appels sont regroupés dans le même act(), sans rendu entre
    // eux — simule un double-tap sur "Enregistrer" (pas de garde
    // anti-rebond aujourd'hui). Le premier (+5, 25/30 au total) ne franchit
    // pas encore le seuil ; le second (+10, 35/30), empilé sur le résultat
    // du premier plutôt que sur l'état d'avant les deux, le franchit.
    act(() => {
      result.current.goals.addProgress('g3', 5);
      result.current.goals.addProgress('g3', 10);
    });

    const entries = result.current.goals.goals.find((g) => g.id === 'g3')?.entries;
    // L'entrée du 10 août (hors double-tap) reste intacte ; les deux appels
    // fusionnent dans l'entrée du jour (todayStr()), qui doit valoir 5 + 10
    // = 15 — pas 5 d'un côté et 10 perdu ou écrasé de l'autre.
    expect(entries).toHaveLength(2);
    expect(entries?.find((e) => e.date === '2026-08-10')?.value).toBe(20);
    expect(entries?.find((e) => e.date === todayStr())?.value).toBe(15);

    expect(mockedSendGoalReachedNotification).toHaveBeenCalledTimes(1);
    expect(mockedSendGoalReachedNotification).toHaveBeenCalledWith('Double-tap goal');
  });
});

describe('replaceAllGoals', () => {
  it('replaces the whole array rather than merging with the existing one', async () => {
    const { result } = await renderHarness();
    act(() => result.current.goals.createGoal(baseGoal));

    const restored: Goal[] = [
      { ...baseGoal, id: 'restored-1' },
      { ...baseGoal, id: 'restored-2' },
    ];
    act(() => result.current.goals.replaceAllGoals(restored));

    expect(result.current.goals.goals.map((g) => g.id)).toEqual(['restored-1', 'restored-2']);
  });

  it('never sends a notification, even when a restored goal is already completed', async () => {
    const { result } = await renderHarness();
    act(() => result.current.settings.updateSettings({ goalReachedNotifs: true }));

    const completedGoal: Goal = {
      ...baseGoal,
      id: 'restored-completed',
      targetValue: 10,
      entries: [{ date: '2026-08-10', value: 10 }],
    };
    act(() => result.current.goals.replaceAllGoals([completedGoal]));

    expect(mockedSendGoalReachedNotification).not.toHaveBeenCalled();
  });
});

describe('recordedAt', () => {
  // Timers réels le temps du rendu initial (chargement async depuis le mock
  // AsyncStorage) : on ne bascule en fake timers qu'une fois le harness prêt,
  // pour ne pas perturber cette résolution avec `now()` figé.
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is stamped on a newly created entry and updated on a same-day merge', async () => {
    const { result } = await renderHarness();

    const fresh: Goal = {
      id: 'g4',
      title: 'Timestamped goal',
      targetValue: 100,
      unit: 'reps',
      createdAt: '2026-08-01T00:00:00.000Z',
      deadline: '2026-08-31T00:00:00.000Z',
      entries: [],
    };
    act(() => result.current.goals.createGoal(fresh));

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-22T10:00:00.000Z'));
    act(() => result.current.goals.addProgress('g4', 5));

    let entry = result.current.goals.goals[0].entries[0];
    expect(entry.value).toBe(5);
    expect(entry.recordedAt).toBe('2026-08-22T10:00:00.000Z');

    // Fusion sur la même entrée du jour, plus tard dans la journée :
    // recordedAt suit le dernier enregistrement, pas la création.
    jest.setSystemTime(new Date('2026-08-22T18:30:00.000Z'));
    act(() => result.current.goals.addProgress('g4', 3));

    entry = result.current.goals.goals[0].entries[0];
    expect(result.current.goals.goals[0].entries).toHaveLength(1);
    expect(entry.value).toBe(8);
    expect(entry.recordedAt).toBe('2026-08-22T18:30:00.000Z');
  });

  it('is stamped on the entry when corrected via updateEntry', async () => {
    const { result } = await renderHarness();
    act(() => result.current.goals.createGoal(baseGoal));

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-23T09:15:00.000Z'));
    act(() => result.current.goals.updateEntry('g1', '2026-08-10', 55));

    const entry = result.current.goals.goals[0].entries.find((e) => e.date === '2026-08-10');
    expect(entry?.value).toBe(55);
    expect(entry?.recordedAt).toBe('2026-08-23T09:15:00.000Z');
  });
});
