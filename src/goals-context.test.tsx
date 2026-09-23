import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { GoalsProvider, useGoals } from './goals-context';
import { sendGoalReachedNotification } from './notifications';
import { SettingsProvider, useSettings } from './settings-context';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settingsStorage';
import { todayStr } from './stats';
import { loadGoals, saveGoals } from './storage';
import { StorageStatusProvider, useStorageStatus } from './storage-status';
import { Goal } from './types';

// sendGoalReachedNotification touches expo-notifications' native module, which
// has nothing real to talk to under jest — mocked so these tests only assert
// *when* goals-context decides to call it, not what it does internally
// (already covered separately by notifications.test.ts's pure-logic tests).
// jest.mock calls are hoisted above imports by babel-jest, so this is safe
// even though it reads as coming "after" the import above.
jest.mock('./notifications', () => ({
  // Résout : la vraie fonction est async et le contexte chaîne un .catch()
  // dessus depuis l'activation de no-floating-promises. Un jest.fn() nu
  // renverrait undefined et ferait planter l'effet.
  sendGoalReachedNotification: jest.fn().mockResolvedValue(undefined),
}));

const mockedSendGoalReachedNotification = sendGoalReachedNotification as jest.Mock;

// loadGoals/saveGoals passent par un mock qui délègue à l'implémentation
// réelle (reposée dans le beforeEach ci-dessous) : les tests existants
// gardent donc le comportement AsyncStorage de bout en bout, et seuls les
// tests d'échec de persistance remplacent la valeur de retour. Mocker le
// module ici plutôt que d'espionner AsyncStorage est délibéré — voir le
// commentaire de describe('échecs de persistance') en fin de fichier.
jest.mock('./storage', () => {
  const actual = jest.requireActual('./storage');
  return {
    ...actual,
    loadGoals: jest.fn(),
    saveGoals: jest.fn(),
  };
});

const actualStorage = jest.requireActual<typeof import('./storage')>('./storage');
const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;

// Même dispositif pour ./settingsStorage : nécessaire au test d'import
// partiel plus bas, qui doit faire échouer la lecture des *deux* zones pour
// montrer qu'un import de goals seuls ne débloque pas celle des settings.
jest.mock('./settingsStorage', () => {
  const actual = jest.requireActual('./settingsStorage');
  return {
    ...actual,
    loadSettings: jest.fn(),
    saveSettings: jest.fn(),
  };
});

const actualSettingsStorage =
  jest.requireActual<typeof import('./settingsStorage')>('./settingsStorage');
const mockedLoadSettings = loadSettings as jest.Mock;
const mockedSaveSettings = saveSettings as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>{children}</GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

// Expose les trois contextes depuis un seul hook : un test peut ainsi
// basculer un réglage (goalReachedNotifs) puis piloter les objectifs depuis
// le même rendu, et lire le statut de persistance que les deux providers y
// écrivent (voir storage-status.tsx).
function useHarness() {
  return { goals: useGoals(), settings: useSettings(), status: useStorageStatus() };
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

// Appelle `call` et vérifie qu'il n'a rien changé, ni en mémoire ni sur le
// disque. Le disque est relu par le vrai loadGoals : une valeur non finie
// qui y serait arrivée se relirait null (JSON.stringify), pas à l'identique.
async function expectNoChange(
  result: { current: ReturnType<typeof useHarness> },
  call: () => void,
) {
  // Laisse la sauvegarde de l'état de départ aboutir avant l'instantané.
  await act(async () => {});
  const before = result.current.goals.goals;

  act(call);
  await act(async () => {});

  expect(result.current.goals.goals).toEqual(before);
  expect(await actualStorage.loadGoals()).toEqual({ value: before, ok: true });
}

// Le mock AsyncStorage est un magasin en mémoire partagé entre les tests
// (module-level) : sans le vider, un test qui persiste des goals/settings
// pollue le chargement initial du suivant.
beforeEach(async () => {
  jest.restoreAllMocks();
  // Les mocks issus d'une factory jest.mock ne sont pas touchés par
  // restoreAllMocks : on leur repose explicitement l'implémentation réelle.
  mockedLoadGoals.mockReset().mockImplementation(actualStorage.loadGoals);
  mockedSaveGoals.mockReset().mockImplementation(actualStorage.saveGoals);
  mockedLoadSettings.mockReset().mockImplementation(actualSettingsStorage.loadSettings);
  mockedSaveSettings.mockReset().mockImplementation(actualSettingsStorage.saveSettings);
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

  // R2 — la garde `newValue <= 0` laisse passer Infinity (> 0) et NaN
  // (NaN <= 0 vaut false). La garde de l'écran (parsePositiveNumber) ne
  // couvre que ses propres appels.
  it.each([[Infinity], [NaN]])(
    'rejects a non-finite newValue (%p) in the context itself, leaving state and storage untouched',
    async (value) => {
      const { result } = await renderHarness();
      act(() => result.current.goals.createGoal(baseGoal));

      await expectNoChange(result, () =>
        result.current.goals.updateEntry('g1', '2026-08-10', value),
      );
    },
  );

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

describe('updateGoal', () => {
  // Une entrée ne porte qu'un nombre : changer l'unité sous elle relirait
  // les mêmes valeurs dans une autre grandeur, sans conversion ni trace.
  // Bloqué dans le contexte et pas seulement à l'écran, comme updateEntry
  // refuse newValue <= 0 quel que soit l'appelant.
  it('ignores a unit change once the goal has entries, without dropping the rest', async () => {
    const { result } = await renderHarness();

    // baseGoal est en 'reps' et porte déjà deux entrées, dont une à 0 : un
    // mélange suffit à verrouiller, seul un objectif sans aucune valeur
    // positive reste libre (voir le dernier test de ce describe).
    act(() => result.current.goals.createGoal(baseGoal));
    act(() =>
      result.current.goals.updateGoal('g1', {
        title: 'Renommé',
        targetValue: 250,
        unit: 'km',
      }),
    );

    const goal = result.current.goals.goals[0];
    // Seul `unit` est écarté du merge : refuser tout l'appel ferait perdre
    // une correction de titre ou de cible que rien ne justifie de bloquer.
    expect(goal.unit).toBe('reps');
    expect(goal.title).toBe('Renommé');
    expect(goal.targetValue).toBe(250);
  });

  // Garde-fou, vert avant comme après : la garde ne doit pas se déclencher
  // sur un objectif neuf, où il n'y a rien à relire dans une autre unité.
  it('still allows a unit change while the goal has no entry', async () => {
    const { result } = await renderHarness();

    act(() => result.current.goals.createGoal({ ...baseGoal, id: 'sans-entree', entries: [] }));
    act(() => result.current.goals.updateGoal('sans-entree', { unit: 'km' }));

    expect(result.current.goals.goals[0].unit).toBe('km');
  });

  // Une entrée à 0 ne porte aucune information dépendante de l'unité : 0 km
  // et 0 reps sont le même nombre, il n'y a rien à relire dans une autre
  // grandeur. Le verrou protège des valeurs existantes, pas la simple
  // présence d'une ligne dans le tableau. Même distinction que
  // ongoingGoalsWithoutTodayEntry (notifications.ts), qui compte une séance
  // sur `e.value > 0` et pas sur l'existence de l'entrée.
  //
  // Cas atteignable par la restauration d'une sauvegarde uniquement : aucun
  // chemin de l'app ne crée une entrée à 0 (addProgress et updateEntry
  // refusent <= 0, deleteEntry retire la ligne au lieu de la mettre à 0),
  // mais findGoalInconsistency laisse délibérément passer e.value === 0.
  it('still allows a unit change when every entry is 0', async () => {
    const { result } = await renderHarness();

    act(() =>
      result.current.goals.createGoal({
        ...baseGoal,
        id: 'que-des-zeros',
        entries: [{ date: '2026-08-10', value: 0 }],
      }),
    );
    act(() => result.current.goals.updateGoal('que-des-zeros', { unit: 'km' }));

    expect(result.current.goals.goals[0].unit).toBe('km');
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

  // R2 — addProgress ne validait pas amount. Infinity et NaN s'écrivent
  // null sur le disque ; -5 retirerait 5 au total du jour ; 0 créerait une
  // entrée à 0, qui fait passer le jour de « pas d'entrée » à « entrée à 0 »
  // pour ongoingGoalsWithoutTodayEntry.
  it.each([[Infinity], [NaN], [0], [-5]])(
    'rejects an amount of %p in the context itself, leaving state and storage untouched',
    async (amount) => {
      const { result } = await renderHarness();
      act(() => result.current.goals.createGoal(emptyGoal));

      await expectNoChange(result, () => result.current.goals.addProgress('g2', amount));
    },
  );

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

    // Horloge posée en heure locale, et non en instants UTC : ce que ce
    // test observe est la fusion de deux enregistrements dans l'entrée d'un
    // même jour, or addProgress date cette entrée avec todayStr(), qui lit
    // le calendrier local. Écrits en UTC (10:00Z puis 18:30Z), les deux
    // instants tombaient sur deux jours locaux distincts à partir d'UTC+6,
    // et une deuxième entrée était créée au lieu d'une fusion.
    const matin = new Date(2026, 7, 22, 10, 0);
    const soir = new Date(2026, 7, 22, 18, 30);

    jest.useFakeTimers();
    jest.setSystemTime(matin);
    act(() => result.current.goals.addProgress('g4', 5));

    let entry = result.current.goals.goals[0].entries[0];
    expect(entry.value).toBe(5);
    expect(entry.recordedAt).toBe(matin.toISOString());

    // Fusion sur la même entrée du jour, plus tard dans la journée :
    // recordedAt suit le dernier enregistrement, pas la création.
    jest.setSystemTime(soir);
    act(() => result.current.goals.addProgress('g4', 3));

    entry = result.current.goals.goals[0].entries[0];
    expect(result.current.goals.goals[0].entries).toHaveLength(1);
    expect(entry.value).toBe(8);
    expect(entry.recordedAt).toBe(soir.toISOString());
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

// L2-02 et L2-05 : jusqu'ici un échec de lecture ou d'écriture du stockage
// ne se distinguait de rien du tout. Deux conséquences observables ici :
// l'app ne doit pas réécrire par-dessus des données qu'elle n'a pas réussi
// à lire, et un échec doit ressortir quelque part plutôt que de rester dans
// la console.
//
// Ces tests passent par les mocks de ./storage (voir le jest.mock en tête de
// fichier) plutôt que par AsyncStorage : AsyncStorage est déjà un mock
// fourni par le paquet, sur lequel jest.spyOn renvoie ce mock existant au
// lieu d'en créer un nouveau — ni jest.restoreAllMocks() ni mockRestore() ne
// lui rendent alors son implémentation d'origine, et un détournement fuit
// sur tous les tests suivants du fichier.
describe('échecs de persistance', () => {
  it('does not save over the stored goals after a failed initial read (L2-02)', async () => {
    // Lecture en échec alors que le disque contient encore les objectifs de
    // l'utilisateur : le scénario de L2-02, où l'app affiche « aucun
    // objectif » par-dessus des données intactes.
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });

    const { result } = await renderHarness();
    expect(result.current.goals.goals).toEqual([]);

    // La première action de l'utilisateur — c'est elle qui écrasait tout.
    act(() => result.current.goals.createGoal(baseGoal));
    // Laisse passer l'effet de sauvegarde et sa microtâche avant d'affirmer
    // qu'aucune écriture n'a eu lieu.
    await act(async () => {});

    expect(mockedSaveGoals).not.toHaveBeenCalled();
  });

  it('surfaces a failed initial read through the storage status context (L2-02)', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });

    const { result } = await renderHarness();

    expect(result.current.status.loadFailed).toBe(true);
  });

  it('surfaces a failed write through the storage status context (L2-05)', async () => {
    const { result } = await renderHarness();
    mockedSaveGoals.mockResolvedValue(false);

    act(() => result.current.goals.createGoal(baseGoal));

    await waitFor(() => expect(result.current.status.saveFailed).toBe(true));
  });

  it('clears the write failure flag once a later write succeeds', async () => {
    const { result } = await renderHarness();
    mockedSaveGoals.mockResolvedValue(false);
    act(() => result.current.goals.createGoal(baseGoal));
    await waitFor(() => expect(result.current.status.saveFailed).toBe(true));

    mockedSaveGoals.mockResolvedValue(true);
    act(() => result.current.goals.createGoal({ ...baseGoal, id: 'g-bis' }));

    await waitFor(() => expect(result.current.status.saveFailed).toBe(false));
  });
});

// Porte de sortie de l'import, ajoutée après la revue de PR #24 : le blocage
// posé par readFailed visait les écritures *automatiques* de l'app, pas une
// restauration de sauvegarde que l'utilisateur a explicitement confirmée
// (voir le dialogue de confirmDestructive dans DataSection.tsx). Sans cette
// porte, un import après un échec de lecture s'affichait à l'écran et
// disparaissait au redémarrage, sans que rien ne le dise.
describe('replaceAllGoals — import explicite', () => {
  // Chemin courant, sans échec de lecture : jusqu'ici aucun test ne
  // vérifiait que replaceAllGoals persiste quoi que ce soit (les deux tests
  // de describe('replaceAllGoals') n'observent que l'état en mémoire). Comme
  // l'import écrit désormais lui-même au lieu de laisser faire l'effet, ce
  // cas change aussi : il lui faut son filet.
  it('persists an ordinary import exactly once', async () => {
    const { result } = await renderHarness();
    const restored: Goal[] = [{ ...baseGoal, id: 'restored-1' }];

    act(() => result.current.goals.replaceAllGoals(restored));
    await act(async () => {});

    expect(mockedSaveGoals).toHaveBeenCalledTimes(1);
    expect(mockedSaveGoals).toHaveBeenCalledWith(restored);
  });

  // Un import et une action utilisateur peuvent tomber dans le même tick :
  // React groupe les deux setGoals sans rendu intercalé, donc l'effet de
  // sauvegarde ne passe qu'une seule fois, sur le seul état commité — celui
  // qui contient les deux. C'est cet état-là qui doit atteindre le disque,
  // pas seulement la liste importée que replaceAllGoals a écrite lui-même.
  // Même dispositif que « loses nothing and notifies exactly once on a
  // double-tap » d'addProgress : deux appels dans un act() unique.
  //
  // Ce test ne tient pas seul. Il reste vert si l'effet écrit à chaque
  // passage sans jamais retenir ce qu'il a écrit — c'est « persists an
  // ordinary import exactly once », juste au-dessus, qui ferme cette
  // sortie-là (il compterait alors deux écritures au lieu d'une). Les deux
  // se relisent ensemble.
  it('persists a change stacked onto the import in the same tick', async () => {
    const { result } = await renderHarness();
    const restored: Goal[] = [{ ...baseGoal, id: 'restored-1' }];

    act(() => {
      result.current.goals.replaceAllGoals(restored);
      result.current.goals.createGoal({ ...baseGoal, id: 'pendant-import' });
    });
    await act(async () => {});

    // L'état affiché porte bien les deux : c'est le disque qui décroche.
    expect(result.current.goals.goals.map((g) => g.id)).toEqual(['pendant-import', 'restored-1']);

    const written = mockedSaveGoals.mock.calls.at(-1)?.[0] as Goal[] | undefined;
    expect(written?.map((g) => g.id)).toEqual(['pendant-import', 'restored-1']);
  });

  it('writes an imported list even though the initial read failed', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });
    const { result } = await renderHarness();
    const restored: Goal[] = [{ ...baseGoal, id: 'restored-1' }];

    act(() => result.current.goals.replaceAllGoals(restored));
    await act(async () => {});

    expect(mockedSaveGoals).toHaveBeenCalledTimes(1);
    expect(mockedSaveGoals).toHaveBeenCalledWith(restored);
  });

  it('clears the read failure once the explicit write succeeds', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });
    const { result } = await renderHarness();
    expect(result.current.status.loadFailed).toBe(true);

    act(() => result.current.goals.replaceAllGoals([{ ...baseGoal, id: 'restored-1' }]));

    await waitFor(() => expect(result.current.status.loadFailed).toBe(false));
  });

  // Une écriture réussie prouve que le stockage répond de nouveau : les
  // sauvegardes automatiques normales doivent repartir sans attendre un
  // redémarrage.
  it('resumes automatic saves once the explicit write succeeds', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });
    const { result } = await renderHarness();

    act(() => result.current.goals.replaceAllGoals([{ ...baseGoal, id: 'restored-1' }]));
    await waitFor(() => expect(result.current.status.loadFailed).toBe(false));
    expect(mockedSaveGoals).toHaveBeenCalledTimes(1);

    act(() => result.current.goals.createGoal({ ...baseGoal, id: 'apres-import' }));

    await waitFor(() => expect(mockedSaveGoals).toHaveBeenCalledTimes(2));
  });

  it('reports a failed import write and keeps the read failure', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });
    const { result } = await renderHarness();
    mockedSaveGoals.mockResolvedValue(false);

    act(() => result.current.goals.replaceAllGoals([{ ...baseGoal, id: 'restored-1' }]));

    await waitFor(() => expect(result.current.status.saveFailed).toBe(true));
    // L'écriture a échoué : rien ne prouve que le stockage soit revenu, le
    // blocage des sauvegardes automatiques reste en place.
    expect(result.current.status.loadFailed).toBe(true);
  });

  // Les deux zones sont suivies séparément (voir storage-status.tsx). Un
  // fichier de sauvegarde sans bloc `settings` ne fait appeler que
  // replaceAllGoals (voir le `if (result.settings)` de DataSection.tsx) :
  // la zone settings doit rester bloquée telle quelle.
  it('leaves the settings area blocked when the import carries no settings', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });
    mockedLoadSettings.mockResolvedValue({ value: DEFAULT_SETTINGS, ok: false });
    const { result } = await renderHarness();

    act(() => result.current.goals.replaceAllGoals([{ ...baseGoal, id: 'restored-1' }]));
    await act(async () => {});

    // Le bandeau reste allumé : la zone settings, elle, n'a pas été réparée.
    expect(result.current.status.loadFailed).toBe(true);

    // Et les réglages restent protégés : un toggle n'écrit toujours rien.
    act(() => result.current.settings.updateSettings({ streakAlert: false }));
    await act(async () => {});

    expect(mockedSaveSettings).not.toHaveBeenCalled();
  });
});
