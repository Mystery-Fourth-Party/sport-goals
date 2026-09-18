// REVUE — LOT 3 (écrans). Preuves, pas correctifs.
//
// Même statut que les lots précédents : chaque test échoue sur master
// (04df1f8). Branche revue/preuves-claude, jamais destinée au merge.
//
// Le lot Écrans n'avait été traité qu'au niveau `medium` par la revue du
// 31/08, qui le déclare elle-même.
import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import ArchiveScreen from '../app/archive';
import { GoalsProvider, useGoals } from '../src/goals-context';
import i18n from '../src/i18n';
import { SettingsProvider } from '../src/settings-context';
import { loadGoals, LoadResult, saveGoals } from '../src/storage';
import { StorageStatusProvider } from '../src/storage-status';
import { Goal } from '../src/types';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

jest.mock('../src/notifications', () => ({
  sendGoalReachedNotification: jest.fn().mockResolvedValue(undefined),
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

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>{children}</GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

function makeCompletedGoal(): Goal {
  return {
    id: 'fini',
    title: 'Objectif terminé',
    targetValue: 100,
    unit: 'reps',
    createdAt: '2026-09-01T12:00:00.000Z',
    deadline: '2026-10-01T12:00:00.000Z',
    entries: [{ date: '2026-09-10', value: 100 }],
  };
}

// Rend loadGoals suspendue : l'écran se monte pendant que `goals` vaut
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

// ─── R3-01 ───────────────────────────────────────────────────────────────
// La garde `loaded` n'a été posée que sur les écrans où un bug est remonté.
//
// app/index.tsx la lit (depuis l'origine), app/goal/[id]/edit.tsx depuis
// PR #25 (L3-01) et app/goal/[id].tsx depuis PR #28. Restent archive.tsx,
// weekly.tsx et create.tsx, qui ne la lisent pas du tout.
//
// Sur archive, la conséquence est un état vide affirmé à tort : « Aucun
// objectif terminé » s'affiche le temps du chargement, sur une archive qui
// en contient. Même nature que le « Objectif introuvable » corrigé en PR #28,
// et même chemin d'arrivée : lien profond, notification, ou tap rapide après
// un démarrage à froid.
describe('R3-01 — état vide affirmé avant chargement', () => {
  it("n'annonce pas une archive vide tant que le chargement n'est pas terminé", () => {
    deferLoad();

    render(<ArchiveScreen />, { wrapper });

    expect(screen.queryByText(i18n.t('archive.emptyTitle'))).toBeNull();
  });

  it("affiche l'archive réelle une fois le chargement résolu", async () => {
    const resolveLoad = deferLoad();
    render(<ArchiveScreen />, { wrapper });

    await act(async () => resolveLoad({ value: [makeCompletedGoal()], ok: true }));

    expect(screen.getByText('Objectif terminé')).toBeTruthy();
  });
});

// ─── R3-02 ───────────────────────────────────────────────────────────────
// Le chargement initial écrase l'état en mémoire sans condition.
//
// L'effet de chargement de GoalsProvider fait setGoals(value) sans regarder
// ce que `goals` contient déjà. Tout ce qui a été créé avant la résolution
// est donc perdu — et l'effet de sauvegarde, gardé par `if (!loaded) return`,
// ne l'a pas écrit non plus entre-temps.
//
// app/create.tsx ne lit pas `loaded` : rien n'empêche d'atteindre le
// formulaire et de valider pendant cette fenêtre. Elle est courte en
// pratique — une lecture AsyncStorage face à une saisie humaine — et c'est la
// raison pour laquelle ce finding est proposé en gravité basse : c'est le
// mécanisme qui est en cause, pas un scénario utilisateur courant.
//
// Troisième manifestation de la même cause, non prouvée séparément :
// DataSection lit `goals` sans `loaded` pour construire l'export. Un export
// déclenché dans la même fenêtre produit un fichier de sauvegarde vide, que
// l'utilisateur conserve en croyant avoir une copie.
describe('R3-02 — objectif créé avant la fin du chargement, puis écrasé', () => {
  it('conserve un objectif créé pendant que le chargement initial est en cours', async () => {
    const resolveLoad = deferLoad();
    const { result } = renderHook(() => useGoals(), { wrapper });

    const cree: Goal = { ...makeCompletedGoal(), id: 'cree-avant-chargement', entries: [] };
    act(() => result.current.createGoal(cree));
    expect(result.current.goals.map((g) => g.id)).toEqual(['cree-avant-chargement']);

    // Le chargement se résout ensuite avec ce que contenait le disque.
    await act(async () => resolveLoad({ value: [makeCompletedGoal()], ok: true }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // L'objectif créé doit survivre : il n'a jamais été écrit sur le disque
    // (l'effet de sauvegarde était gardé par !loaded), donc s'il disparaît
    // de l'état il n'existe plus nulle part.
    expect(result.current.goals.map((g) => g.id)).toContain('cree-avant-chargement');
  });
});
