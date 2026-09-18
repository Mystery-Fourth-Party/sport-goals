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
import { act, render, screen } from '@testing-library/react-native';
import GoalDetailScreen from '../app/goal/[id]';
import { GoalsProvider } from '../src/goals-context';
import i18n from '../src/i18n';
import { SettingsProvider } from '../src/settings-context';
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
