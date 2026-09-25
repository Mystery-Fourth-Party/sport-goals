// Garde de chargement de l'écran Détail — hors tri, repérée en marge de la
// revue de PR3 (L3-01).
//
// GoalDetailScreen fait goals.find(...) puis affiche « Objectif introuvable »
// dès que le résultat est undefined, sans lire le booléen `loaded` que
// GoalsProvider expose pourtant. Si l'écran monte avant que loadGoals ait
// résolu — lien profond, notification, ou tap rapide après un démarrage à
// froid — `goals` vaut encore [], donc l'écran annonce un objectif
// introuvable qui existe très bien, avant de basculer sur le vrai contenu.
//
// Contrairement à L3-01, rien n'est perdu ici : c'est un faux message
// transitoire, pas un écrasement de données. D'où une simple garde, sans le
// key/remount de PR3 — cet écran n'a aucun useState initialisé depuis `goal`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import GoalDetailScreen from '../app/goal/[id]';
import { GoalsProvider } from '../src/goals-context';
import i18n from '../src/i18n';
import { SettingsProvider } from '../src/settings-context';
import { dateStr, fmt } from '../src/stats';
import { loadGoals, LoadResult, saveGoals } from '../src/storage';
import { StorageStatusProvider } from '../src/storage-status';
import { Goal } from '../src/types';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'g1' }),
}));

jest.mock('../src/storage', () => {
  const actual = jest.requireActual('../src/storage');
  return { ...actual, loadGoals: jest.fn(), saveGoals: jest.fn() };
});

const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;

beforeAll(() => i18n.changeLanguage('fr'));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedLoadGoals.mockReset();
  mockedSaveGoals.mockReset().mockResolvedValue(true);
});

function makeGoal(): Goal {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  return {
    id: 'g1',
    title: 'Courir 100 km',
    targetValue: 100,
    unit: 'km',
    createdAt: '2026-09-01T12:00:00.000Z',
    deadline: deadline.toISOString(),
    entries: [{ date: '2026-09-10', value: 12 }],
  };
}

// Rend loadGoals suspendue : l'écran se monte donc pendant que `goals` vaut
// encore [], comme sur un démarrage à froid qui atterrit sur cette route.
function deferLoad(): (result: LoadResult<Goal[]>) => void {
  let resolveLoad!: (result: LoadResult<Goal[]>) => void;
  mockedLoadGoals.mockReturnValue(
    new Promise<LoadResult<Goal[]>>((resolve) => {
      resolveLoad = resolve;
    }),
  );
  return resolveLoad;
}

function renderScreen() {
  render(
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>
          <GoalDetailScreen />
        </GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>,
  );
}

describe('GoalDetailScreen', () => {
  it("n'annonce pas « Objectif introuvable » tant que le chargement n'est pas terminé", () => {
    deferLoad();

    renderScreen();

    expect(screen.queryByText(i18n.t('goalDetail.notFound'))).toBeNull();
  });

  it("affiche l'objectif une fois le chargement résolu", async () => {
    const goal = makeGoal();
    const resolveLoad = deferLoad();
    renderScreen();

    await act(async () => resolveLoad({ value: [goal], ok: true }));

    expect(screen.getByText(goal.title)).toBeTruthy();
    expect(screen.queryByText(i18n.t('goalDetail.notFound'))).toBeNull();
  });

  // Garde-fou, vert avant comme après : une fois le chargement terminé, un id
  // qui ne correspond à rien doit toujours donner « Objectif introuvable ».
  // Le correctif ne doit pas transformer ce cas en attente perpétuelle.
  it('affiche « Objectif introuvable » quand l objectif est absent après chargement', async () => {
    const resolveLoad = deferLoad();
    renderScreen();

    await act(async () => resolveLoad({ value: [], ok: true }));

    expect(screen.getByText(i18n.t('goalDetail.notFound'))).toBeTruthy();
  });
});

// Un objectif clos est archivé en lecture seule : la modification
// ressusciterait l'objectif (« Jours restants » pré-rempli, échéance
// recalculée depuis aujourd'hui), et un ajout du jour tomberait après
// l'échéance. Correction d'entrée et suppression restent accessibles.
describe('GoalDetailScreen — objectif clos', () => {
  function closedGoal(): Goal {
    return {
      ...makeGoal(),
      createdAt: '2026-08-01T12:00:00.000Z',
      deadline: '2026-08-31T12:00:00.000Z',
      entries: [{ date: '2026-08-10', value: 95 }],
    };
  }

  async function renderWith(goal: Goal) {
    mockedLoadGoals.mockResolvedValue({ value: [goal], ok: true });
    renderScreen();
    await act(async () => {});
  }

  it("propose la modification et l'ajout sur un objectif ouvert", async () => {
    await renderWith(makeGoal());

    expect(screen.getByLabelText(i18n.t('goalDetail.header.editA11y'))).toBeTruthy();
    expect(screen.getByText(i18n.t('goalDetail.addProgressCta'))).toBeTruthy();
  });

  it("n'offre ni modification ni ajout sur un objectif clos", async () => {
    await renderWith(closedGoal());

    expect(screen.queryByLabelText(i18n.t('goalDetail.header.editA11y'))).toBeNull();
    expect(screen.queryByText(i18n.t('goalDetail.addProgressCta'))).toBeNull();
    expect(screen.getByLabelText(i18n.t('statusSpoken.failed'))).toBeTruthy();
  });

  it('garde la suppression et la correction d entrée sur un objectif clos', async () => {
    await renderWith(closedGoal());

    expect(screen.getByText(i18n.t('goalDetail.deleteGoal'))).toBeTruthy();
    // Libellé de ligne construit comme GoalHistoryList : « <date>, <valeur> <unité parlée> ».
    const rowLabel = `, ${fmt(95, 'km')} ${i18n.t('unitSpoken.km')}`;
    const escaped = rowLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    fireEvent.press(screen.getByRole('button', { name: new RegExp(`${escaped}$`) }));
    expect(screen.getByText(i18n.t('progressModal.titleEdit'))).toBeTruthy();
  });

  // Témoin puis cas : la même progression de 95 % affiche la bannière tant
  // que l'objectif est ouvert, et plus une fois clos.
  it.each([
    ['ouvert', () => ({ ...closedGoal(), deadline: makeGoal().deadline }), true],
    ['clos', closedGoal, false],
  ] as const)('« Presque là » sur un objectif %s à 95 % : %p', async (_, goal, shown) => {
    await AsyncStorage.setItem('settings', JSON.stringify({ almostThereNotifs: true }));
    await renderWith(goal());

    expect(screen.queryByText(i18n.t('goalDetail.header.almostBannerTitle')) !== null).toBe(shown);
  });
});

// R2 — handleSave ne gardait que `!value || value <= 0`. Number('1e400')
// vaut Infinity, qui passe les deux : l'entrée était enregistrée, puis
// JSON.stringify l'écrivait null, un fichier que l'import rejette en bloc.
describe('GoalDetailScreen — valeur de séance hors domaine', () => {
  // Résolus à l'appel et non au chargement du describe : la langue n'est
  // passée en français qu'au beforeAll.
  const valueField = () =>
    screen.getByLabelText(i18n.t('progressModal.valueA11y', { unit: i18n.t('unitSpoken.km') }));
  const errorText = () => screen.getByText(i18n.t('progressModal.errorPositive'));

  function savedNonFiniteValues(): number[] {
    return mockedSaveGoals.mock.calls.flatMap(([goals]: [Goal[]]) =>
      goals.flatMap((g) => g.entries.map((e) => e.value).filter((v) => !Number.isFinite(v))),
    );
  }

  async function renderLoaded(goal: Goal) {
    mockedLoadGoals.mockResolvedValue({ value: [goal], ok: true });
    renderScreen();
    await act(async () => {});
  }

  it('refuse une valeur qui déborde en Infinity à l ajout', async () => {
    await renderLoaded(makeGoal());

    fireEvent.press(screen.getByText(i18n.t('goalDetail.addProgressCta')));
    fireEvent.changeText(valueField(), '1e400');
    await act(async () => fireEvent.press(screen.getByText(i18n.t('progressModal.save'))));

    expect(errorText()).toBeTruthy();
    expect(savedNonFiniteValues()).toEqual([]);
  });

  it('refuse une valeur qui déborde en Infinity à la modification', async () => {
    const goal = { ...makeGoal(), entries: [{ date: dateStr(new Date()), value: 12 }] };
    await renderLoaded(goal);

    // Libellé de ligne construit comme GoalHistoryList : « <date>, <valeur> <unité parlée> ».
    const rowLabel = `, ${fmt(12, 'km')} ${i18n.t('unitSpoken.km')}`;
    const escaped = rowLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    fireEvent.press(screen.getByRole('button', { name: new RegExp(`${escaped}$`) }));
    fireEvent.changeText(valueField(), '1e400');
    await act(async () => fireEvent.press(screen.getByText(i18n.t('progressModal.save'))));

    expect(errorText()).toBeTruthy();
    expect(savedNonFiniteValues()).toEqual([]);
  });
});
