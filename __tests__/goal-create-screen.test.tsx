// Couvre l'écran Création (app/create.tsx) : création vierge, et relance d'un
// objectif clos via /create?from=<id> (formulaire pré-rempli, nouvel objectif
// créé, source intacte, retour à l'accueil).
//
// Ne peut pas être colocalisé à côté de app/create.tsx : tout fichier de app/
// devient une route d'expo-router. Ne teste pas le bouton « Relancer » de
// l'écran Détail, couvert par goal-detail-screen.test.tsx.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import CreateGoalScreen from '../app/create';
import { GoalsProvider } from '../src/goals-context';
import { MAX_GOAL_DAYS } from '../src/goalValidation';
import i18n from '../src/i18n';
import { SettingsProvider } from '../src/settings-context';
import { dateStr } from '../src/stats';
import { loadGoals, LoadResult, saveGoals } from '../src/storage';
import { StorageStatusProvider } from '../src/storage-status';
import { Goal, Unit } from '../src/types';

// `from` est lu à chaque rendu : un test le change avant de monter l'écran.
let mockParams: { from?: string } = {};
const mockRouter = { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('../src/storage', () => {
  const actual = jest.requireActual('../src/storage');
  return { ...actual, loadGoals: jest.fn(), saveGoals: jest.fn() };
});

const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;

// Midi UTC : la date locale reste la même sous UTC, New York et Tokyo.
const NOW = new Date('2026-09-30T12:00:00.000Z');

beforeAll(() => i18n.changeLanguage('fr'));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedLoadGoals.mockReset();
  mockedSaveGoals.mockReset().mockResolvedValue(true);
  mockRouter.back.mockReset();
  mockRouter.push.mockReset();
  mockRouter.dismissTo.mockReset();
  mockParams = {};
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => jest.useRealTimers());

// Objectif clos de 30 jours (échéance passée), avec réglages de rappel
// non par défaut pour que le pré-remplissage soit distinguable d'un
// formulaire vierge.
function closedGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'src',
    title: 'Courir 100 km',
    targetValue: 100,
    unit: 'km',
    createdAt: '2026-07-01T12:00:00.000Z',
    deadline: '2026-07-31T12:00:00.000Z',
    entries: [
      { date: '2026-07-05', value: 40 },
      { date: '2026-07-20', value: 45 },
    ],
    reminderEnabled: true,
    reminderTime: '07:30',
    remindAfterReached: true,
    ...overrides,
  };
}

function openGoal(): Goal {
  return closedGoal({ id: 'open', deadline: '2026-10-30T12:00:00.000Z' });
}

function deferLoad(): (result: LoadResult<Goal[]>) => void {
  let resolveLoad!: (result: LoadResult<Goal[]>) => void;
  mockedLoadGoals.mockReturnValue(
    new Promise<LoadResult<Goal[]>>((resolve) => {
      resolveLoad = resolve;
    }),
  );
  return resolveLoad;
}

function Tree() {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>
          <CreateGoalScreen />
        </GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

// Purge les animations du Toggle rendu par GoalFields (Animated.timing,
// 200 ms) : sans ça leurs mises à jour d'état tombent hors de act().
async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

async function renderWith(goals: Goal[]) {
  mockedLoadGoals.mockResolvedValue({ value: goals, ok: true });
  render(<Tree />);
  await flush();
}

const NAME = () => i18n.t('goalFields.name');
const TARGET = () => i18n.t('goalFields.targetValue');
const DURATION = () => i18n.t('goalForm.durationLabel');

// L'horloge est refigée juste avant l'appui : flush() fait avancer les timers
// simulés, et createdAt/échéance sont comparés à des valeurs exactes.
async function submit() {
  jest.setSystemTime(NOW);
  fireEvent.press(screen.getByText(i18n.t('goalForm.submit')));
  await flush();
}

function fieldValue(label: string): string {
  return screen.getByLabelText(label).props.value;
}

function unitChip(u: Unit) {
  return screen.getByLabelText(i18n.t('goalFields.unitA11y', { unit: i18n.t(`unitSpoken.${u}`) }));
}

function toggleChecked(labelKey: string): boolean {
  return screen.getByRole('switch', { name: i18n.t(labelKey) }).props.accessibilityState.checked;
}

// Goals passés à la dernière écriture disque : c'est ce que l'utilisateur
// retrouverait au prochain démarrage.
function lastSavedGoals(): Goal[] {
  const calls = mockedSaveGoals.mock.calls;
  return calls.length === 0 ? [] : calls[calls.length - 1][0];
}

describe('CreateGoalScreen — création vierge', () => {
  it('affiche le formulaire vide avec le titre standard et revient en arrière après création', async () => {
    await renderWith([]);

    expect(screen.getByText(i18n.t('create.title'))).toBeTruthy();
    expect(fieldValue(NAME())).toBe('');

    fireEvent.changeText(screen.getByLabelText(NAME()), 'Pompes');
    fireEvent.changeText(screen.getByLabelText(TARGET()), '50');
    fireEvent.changeText(screen.getByLabelText(DURATION()), '10');
    fireEvent.press(screen.getByText(i18n.t('goalForm.submit')));
    await flush();

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(lastSavedGoals()[0].title).toBe('Pompes');
  });
});

describe('CreateGoalScreen — relance depuis un objectif clos', () => {
  beforeEach(() => {
    mockParams = { from: 'src' };
  });

  it('pré-remplit les champs, la durée d origine et les réglages de rappel', async () => {
    await renderWith([closedGoal()]);

    expect(screen.getByText(i18n.t('create.restartTitle'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('create.title'))).toBeNull();
    expect(fieldValue(NAME())).toBe('Courir 100 km');
    expect(fieldValue(TARGET())).toBe('100');
    expect(fieldValue(DURATION())).toBe('30');
    expect(unitChip('km').props.accessibilityState.selected).toBe(true);
    expect(toggleChecked('goalFields.remindersEnabled')).toBe(true);
    expect(toggleChecked('goalFields.customTime')).toBe(true);
    expect(toggleChecked('goalFields.remindAfterReached')).toBe(true);
  });

  it('reprend un rappel désactivé sur la source', async () => {
    await renderWith([closedGoal({ reminderEnabled: false })]);

    expect(toggleChecked('goalFields.remindersEnabled')).toBe(false);
  });

  it('crée un nouvel objectif, laisse la source intacte et retourne à l accueil', async () => {
    const source = closedGoal();
    const before = structuredClone(source);
    await renderWith([source]);

    await submit();

    const saved = lastSavedGoals();
    expect(saved).toHaveLength(2);
    const created = saved.find((g) => g.id !== 'src')!;
    expect(created.title).toBe('Courir 100 km');
    expect(created.targetValue).toBe(100);
    expect(created.unit).toBe('km');
    expect(created.entries).toEqual([]);
    expect(created.createdAt).toBe(NOW.toISOString());
    // Jour local et non instant : +30 jours franchit la fin de l'heure d'été
    // européenne (25 octobre), et setDate conserve l'heure locale.
    expect(dateStr(new Date(created.deadline))).toBe('2026-10-30');
    expect(created.reminderEnabled).toBe(true);
    expect(created.reminderTime).toBe('07:30');
    expect(created.remindAfterReached).toBe(true);
    expect(saved.find((g) => g.id === 'src')).toEqual(before);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('enregistre les valeurs modifiées (cible, durée, unité) et non celles de la source', async () => {
    await renderWith([closedGoal()]);

    fireEvent.changeText(screen.getByLabelText(TARGET()), '150');
    fireEvent.changeText(screen.getByLabelText(DURATION()), '45');
    fireEvent.press(unitChip('reps'));
    await submit();

    expect(lastSavedGoals()).toHaveLength(2);
    const created = lastSavedGoals().find((g) => g.id !== 'src')!;
    expect(created.targetValue).toBe(150);
    expect(created.unit).toBe('reps');
    // Jour local et non instant : +45 jours franchit la fin de l'heure d'été
    // américaine (1er novembre), et setDate conserve l'heure locale.
    expect(dateStr(new Date(created.deadline))).toBe('2026-11-14');
  });

  it('ne crée rien quand on revient en arrière sans valider', async () => {
    await renderWith([closedGoal()]);

    fireEvent.press(screen.getByLabelText(i18n.t('common.back')));
    await flush();

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockedSaveGoals.mock.calls.filter(([goals]: [Goal[]]) => goals.length > 1)).toEqual([]);
  });

  it('pré-remplit une durée d origine au-delà de la limite et la refuse à la soumission', async () => {
    const longGoal = closedGoal({
      createdAt: '2025-01-01T12:00:00.000Z',
      deadline: '2026-02-05T12:00:00.000Z',
    });
    await renderWith([longGoal]);

    expect(fieldValue(DURATION())).toBe('400');
    fireEvent.press(screen.getByText(i18n.t('goalForm.submit')));
    await flush();

    expect(
      screen.getByText(i18n.t('goalForm.durationTooLong', { max: MAX_GOAL_DAYS })),
    ).toBeTruthy();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(mockedSaveGoals).not.toHaveBeenCalled();
  });

  it('plancher la durée pré-remplie à 1 jour', async () => {
    await renderWith([closedGoal({ createdAt: '2026-07-31T12:00:00.000Z' })]);

    expect(fieldValue(DURATION())).toBe('1');
  });

  it('pré-remplit le formulaire quand le chargement se termine après le montage', async () => {
    const resolveLoad = deferLoad();
    render(<Tree />);
    await flush();

    expect(screen.queryByLabelText(NAME())).toBeNull();

    await act(async () => resolveLoad({ value: [closedGoal()], ok: true }));
    await flush();

    expect(fieldValue(NAME())).toBe('Courir 100 km');
    expect(fieldValue(TARGET())).toBe('100');
    expect(fieldValue(DURATION())).toBe('30');
  });

  it('affiche un formulaire vide et le titre standard quand la source est introuvable', async () => {
    mockParams = { from: 'inconnu' };
    await renderWith([closedGoal()]);

    expect(screen.getByText(i18n.t('create.title'))).toBeTruthy();
    expect(fieldValue(NAME())).toBe('');
    expect(fieldValue(TARGET())).toBe('');
  });

  it('affiche un formulaire vide et le titre standard quand la source n est pas close', async () => {
    mockParams = { from: 'open' };
    await renderWith([openGoal()]);

    expect(screen.getByText(i18n.t('create.title'))).toBeTruthy();
    expect(fieldValue(NAME())).toBe('');
    expect(fieldValue(TARGET())).toBe('');
  });
});

describe('CreateGoalScreen — répétition automatique', () => {
  const REPEAT = () => i18n.t('goalFields.repeat');

  async function fillAndSubmit() {
    fireEvent.changeText(screen.getByLabelText(NAME()), 'Pompes');
    fireEvent.changeText(screen.getByLabelText(TARGET()), '50');
    fireEvent.changeText(screen.getByLabelText(DURATION()), '10');
    await submit();
  }

  it('crée un objectif de série avec un identifiant de série quand la coche est cochée', async () => {
    await renderWith([]);

    fireEvent.press(screen.getByRole('switch', { name: REPEAT() }));
    await fillAndSubmit();

    const created = lastSavedGoals()[0];
    expect(created.repeat).toBe(true);
    expect(typeof created.seriesId).toBe('string');
    expect(created.seriesId).not.toBe('');
  });

  it('crée un objectif hors série quand la coche reste décochée', async () => {
    await renderWith([]);

    expect(toggleChecked('goalFields.repeat')).toBe(false);
    await fillAndSubmit();

    const created = lastSavedGoals()[0];
    expect('repeat' in created).toBe(false);
    expect('seriesId' in created).toBe(false);
  });

  // Relance manuelle depuis un archivé de série : un objectif indépendant,
  // sans lien avec la série de la source.
  it('relance un archivé de série avec la coche décochée et sans identifiant de série', async () => {
    mockParams = { from: 'src' };
    await renderWith([closedGoal({ repeat: true, seriesId: 'serie-source' })]);

    expect(toggleChecked('goalFields.repeat')).toBe(false);
    await submit();

    const created = lastSavedGoals().find((g) => g.id !== 'src')!;
    expect('repeat' in created).toBe(false);
    expect('seriesId' in created).toBe(false);
  });
});
