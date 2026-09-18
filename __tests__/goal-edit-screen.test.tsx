// Premier test d'écran du dépôt. Il ne peut pas être colocalisé à côté de
// app/goal/[id]/edit.tsx : le require.context d'expo-router
// (node_modules/expo-router/_ctx.js) n'exclut que les fichiers `+api` et
// `+html`, donc tout autre fichier de app/ devient une route — un
// edit.test.tsx y créerait une route /goal/[id]/edit.test.
import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EditGoalScreen from '../app/goal/[id]/edit';
import { GoalsProvider } from '../src/goals-context';
import i18n from '../src/i18n';
import { SettingsProvider } from '../src/settings-context';
import { fmt, getGoalStats, todayStr } from '../src/stats';
import { loadGoals, LoadResult, saveGoals } from '../src/storage';
import { StorageStatusProvider } from '../src/storage-status';
import { Goal } from '../src/types';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'g1' }),
}));

// Même dispositif que goals-context.test.tsx : le mock délègue à
// l'implémentation réelle, et seuls les tests qui veulent piloter le moment
// de la résolution remplacent la valeur de retour.
jest.mock('../src/storage', () => {
  const actual = jest.requireActual('../src/storage');
  return {
    ...actual,
    loadGoals: jest.fn(),
    saveGoals: jest.fn(),
  };
});

const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;

// Échéance calculée depuis la date d'exécution plutôt qu'écrite en dur : les
// jours restants, et donc la valeur attendue du champ "Jours restants",
// dépendent du jour où la suite tourne.
const DAYS_AHEAD = 100;

function makeGoal(): Goal {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + DAYS_AHEAD);
  return {
    id: 'g1',
    title: 'Courir 100 km',
    targetValue: 100,
    unit: 'km',
    createdAt: '2026-09-01T00:00:00.000Z',
    deadline: deadline.toISOString(),
    entries: [{ date: '2026-09-10', value: 12 }],
  };
}

function Tree({ show, children }: { show: boolean; children?: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>
          {show ? <EditGoalScreen /> : null}
          {children}
        </GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

// Rend loadGoals suspendue : l'écran se monte donc pendant que `goals` vaut
// encore [], exactement comme sur un démarrage à froid qui atterrit
// directement sur la route (lien profond sport-goals://goal/<id>/edit, ou
// rechargement de l'URL sur le web). Renvoie de quoi la résoudre à la main.
function deferLoad(): (result: LoadResult<Goal[]>) => void {
  let resolveLoad!: (result: LoadResult<Goal[]>) => void;
  mockedLoadGoals.mockReturnValue(
    new Promise<LoadResult<Goal[]>>((resolve) => {
      resolveLoad = resolve;
    }),
  );
  return resolveLoad;
}

// Purge les animations du Toggle rendu par GoalFields (Animated.timing,
// 200 ms, useNativeDriver: false) en plus des microtâches en attente. Sans
// ça, leurs mises à jour d'état tombent hors de act() et React les signale
// bruyamment en console.error à chaque test.
async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

function fieldValue(label: string): string {
  return screen.getByLabelText(label).props.value;
}

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const NAME = i18n.t('goalFields.name');
const TARGET = i18n.t('goalFields.targetValue');
const DURATION = i18n.t('editGoal.durationLabel');
const SAVE = i18n.t('editGoal.save');
const NOT_FOUND = i18n.t('goalDetail.notFound');

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedLoadGoals.mockReset();
  mockedSaveGoals.mockReset().mockResolvedValue(true);
  // Posés après le clear d'AsyncStorage, dont le mock ne doit pas voir de
  // timers simulés le temps de se vider.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('EditGoalScreen monté avant le chargement des objectifs', () => {
  it('initialise les champs avec l objectif une fois le chargement résolu', async () => {
    const goal = makeGoal();
    const resolveLoad = deferLoad();
    render(<Tree show />);

    await act(async () => resolveLoad({ value: [goal], ok: true }));
    await flush();

    expect(fieldValue(NAME)).toBe(goal.title);
    expect(fieldValue(TARGET)).toBe('100');
    expect(fieldValue(DURATION)).toBe(String(getGoalStats(goal, todayStr()).remainingDays));
  });

  it("n'écrase pas unit et deadline quand on enregistre après un chargement différé", async () => {
    const goal = makeGoal();
    const resolveLoad = deferLoad();
    render(<Tree show />);
    await act(async () => resolveLoad({ value: [goal], ok: true }));
    await flush();

    // Le titre et la cible sont les deux seuls champs qui bloquent
    // l'enregistrement quand ils sont vides (voir canSave dans edit.tsx) :
    // l'utilisateur les remplit, croyant simplement corriger son objectif.
    // unit et deadline, eux, n'ont aucune validation qui l'arrête.
    fireEvent.changeText(screen.getByLabelText(NAME), 'Courir 150 km');
    fireEvent.changeText(screen.getByLabelText(TARGET), '150');
    fireEvent.press(screen.getByText(SAVE));

    await waitFor(() => expect(mockedSaveGoals).toHaveBeenCalled());
    const saved: Goal = mockedSaveGoals.mock.calls.at(-1)[0][0];
    expect(saved.targetValue).toBe(150);
    // Les deux champs que l'utilisateur n'a pas touchés doivent survivre.
    expect(saved.unit).toBe('km');
    expect(daysUntil(saved.deadline)).toBeGreaterThan(30);
  });

  it("n'annonce pas « Objectif introuvable » tant que le chargement n'est pas terminé", async () => {
    deferLoad();

    render(<Tree show />);
    await flush();

    expect(screen.queryByText(NOT_FOUND)).toBeNull();
  });

  // Garde-fou, vert avant comme après : une fois le chargement terminé, un
  // id qui ne correspond à rien doit toujours donner « Objectif introuvable »
  // — le correctif ne doit pas transformer ce cas en écran d'attente perpétuel.
  it('affiche « Objectif introuvable » quand l objectif est absent après chargement', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: true });

    render(<Tree show />);
    await flush();

    expect(screen.getByText(NOT_FOUND)).toBeTruthy();
  });

  // Garde-fou, vert avant comme après : c'est le chemin qui fonctionne
  // aujourd'hui (liste → détail → édition), où GoalsProvider a chargé bien
  // avant que l'écran ne monte. Il doit le rester.
  it('chemin normal : les objectifs sont déjà chargés quand l écran monte', async () => {
    const goal = makeGoal();
    mockedLoadGoals.mockResolvedValue({ value: [goal], ok: true });
    const { rerender } = render(<Tree show={false} />);
    await flush();

    rerender(<Tree show />);
    await flush();

    expect(fieldValue(NAME)).toBe(goal.title);
    expect(fieldValue(TARGET)).toBe('100');
  });
});

// L4-01 — t('editGoal.remainingToComplete', ...) mélangeait dans le même
// appel un `unit` brut (non traduit) et un `unitLabel` correctement traduit,
// pour une clé qui vaut « {{unit}}/jour · encore {{value}} {{unitLabel}} à
// accomplir ». Rendu : « reps/jour · encore 5 répétitions à accomplir ».
//
// L'unité du fixture est volontairement 'min' : c'est, avec 'h', la seule
// dont le libellé diffère de sa clé technique dans les *deux* langues
// ('minutes' en fr comme en en). 'km' vaut « km » partout, et 'reps' vaut
// « reps » en anglais — or ce fichier ne force pas la langue, il tourne donc
// dans celle que jest détecte. Sur ces unités-là le défaut est invisible.
describe('EditGoalScreen — libellé du rythme restant', () => {
  it('spells out the unit rather than mixing its technical key into the sentence', async () => {
    const goal: Goal = { ...makeGoal(), unit: 'min' };
    mockedLoadGoals.mockResolvedValue({ value: [goal], ok: true });
    render(<Tree show />);
    await flush();

    // La carte « nouveau rythme » n'apparaît que sur un formulaire valide.
    const remaining = goal.targetValue - 12;
    const expected = i18n.t('editGoal.remainingToComplete', {
      unit: i18n.t('unit.min'),
      value: fmt(remaining, 'min'),
      unitLabel: i18n.t('unit.min'),
    });
    const withRawKey = i18n.t('editGoal.remainingToComplete', {
      unit: 'min',
      value: fmt(remaining, 'min'),
      unitLabel: i18n.t('unit.min'),
    });

    expect(screen.queryByText(withRawKey)).toBeNull();
    expect(screen.getByText(expected)).toBeTruthy();
  });
});
