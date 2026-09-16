// L1-08 — aucun recalcul du jour au passage de minuit.
//
// getGoalStats est pure et reçoit `today` en paramètre, recalculé à chaque
// rendu via todayStr(). Mais rien ne provoque de nouveau rendu si l'app
// reste ouverte ou revient de l'arrière-plan à cheval sur minuit : les
// écrans continuent d'afficher les jours restants, le streak et le statut
// de la veille. Aucun usage d'AppState n'existait dans le dépôt avant ce
// hook.
import { AppState, AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useToday } from './useToday';

// Capture le gestionnaire passé à AppState pour pouvoir simuler une
// transition sans dépendre d'un vrai cycle de vie d'application.
function captureAppStateHandler() {
  const remove = jest.fn();
  let handler!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
    if (event === 'change') handler = cb as (state: AppStateStatus) => void;
    return { remove } as ReturnType<typeof AppState.addEventListener>;
  });
  return {
    fire: (state: AppStateStatus) => act(() => handler(state)),
    remove,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 7, 21, 23, 50));
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useToday', () => {
  it('renvoie le jour courant au montage', () => {
    captureAppStateHandler();

    const { result } = renderHook(() => useToday());

    expect(result.current).toBe('2026-08-21');
  });

  it('recalcule le jour quand l application repasse au premier plan', () => {
    const appState = captureAppStateHandler();
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-08-21');

    // Minuit passe pendant que l'app est en arrière-plan.
    jest.setSystemTime(new Date(2026, 7, 22, 0, 10));
    appState.fire('active');

    expect(result.current).toBe('2026-08-22');
  });

  it('ne recalcule pas sur un passage en arrière-plan', () => {
    const appState = captureAppStateHandler();
    const { result } = renderHook(() => useToday());

    jest.setSystemTime(new Date(2026, 7, 22, 0, 10));
    appState.fire('background');

    // Le jour affiché ne doit changer qu'au retour au premier plan : le
    // rendu qui suit une mise en arrière-plan n'est pas vu par l'utilisateur.
    expect(result.current).toBe('2026-08-21');
  });

  it('ne change pas de référence quand le jour est resté le même', () => {
    const appState = captureAppStateHandler();
    const { result } = renderHook(() => useToday());
    const first = result.current;

    appState.fire('active');

    expect(result.current).toBe(first);
  });

  it('retire son abonnement au démontage', () => {
    const appState = captureAppStateHandler();
    const { unmount } = renderHook(() => useToday());

    unmount();

    expect(appState.remove).toHaveBeenCalledTimes(1);
  });
});
