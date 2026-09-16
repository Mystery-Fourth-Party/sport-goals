import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { SettingsProvider, useSettings } from './settings-context';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './settingsStorage';
import { LoadResult } from './storage';
import { StorageStatusProvider, useStorageStatus } from './storage-status';

// loadSettings/saveSettings mockées directement (plutôt que le mock
// AsyncStorage sous-jacent, voir goals-context.test.tsx) pour garder le
// contrôle exact de quand la promesse de chargement se résout — nécessaire
// pour observer l'état "avant résolution" de façon déterministe.
jest.mock('./settingsStorage', () => {
  const actual = jest.requireActual('./settingsStorage');
  return {
    ...actual,
    loadSettings: jest.fn(),
    saveSettings: jest.fn(),
  };
});

const mockedLoadSettings = loadSettings as jest.Mock;
const mockedSaveSettings = saveSettings as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>{children}</SettingsProvider>
    </StorageStatusProvider>
  );
}

// Réglages et statut de persistance depuis le même rendu : les tests
// d'échec doivent pouvoir déclencher un updateSettings puis lire le drapeau
// que le provider a posé (voir storage-status.tsx).
function useHarness() {
  return { settings: useSettings(), status: useStorageStatus() };
}

beforeEach(() => {
  mockedLoadSettings.mockReset();
  mockedSaveSettings.mockReset();
  // saveSettings est async : le provider chaîne un .catch() dessus depuis
  // l'activation de no-floating-promises. mockReset() efface toute
  // implémentation, il faut donc reposer une promesse ici, sinon le mock
  // renvoie undefined et le provider plante au lieu de sauvegarder.
  mockedSaveSettings.mockResolvedValue(true);
});

describe('SettingsProvider', () => {
  it('exposes DEFAULT_SETTINGS and loaded: false before loadSettings resolves', () => {
    // Promesse jamais résolue dans ce test : on observe uniquement l'état
    // affiché avant toute résolution, pas ce qui se passe après.
    mockedLoadSettings.mockReturnValue(new Promise<LoadResult<Settings>>(() => {}));

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.loaded).toBe(false);
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('exposes loaded: true and the loaded settings once loadSettings resolves', async () => {
    const loaded: Settings = { ...DEFAULT_SETTINGS, dailyReminder: true, reminderTime: '07:30' };
    mockedLoadSettings.mockResolvedValue({ value: loaded, ok: true });

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.settings).toEqual(loaded);
  });

  it('updateSettings merges partially instead of replacing', async () => {
    mockedLoadSettings.mockResolvedValue({ value: DEFAULT_SETTINGS, ok: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.updateSettings({ dailyReminder: true }));

    expect(result.current.settings).toEqual({ ...DEFAULT_SETTINGS, dailyReminder: true });
  });

  it('calls saveSettings with the merged result after a post-load change, but not on the load itself', async () => {
    mockedLoadSettings.mockResolvedValue({ value: DEFAULT_SETTINGS, ok: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // Le tout premier passage de l'effet de sauvegarde suivant le chargement
    // ne doit pas re-sauvegarder des données identiques à ce qui vient
    // d'être lu (voir skipNextSave dans settings-context.tsx).
    expect(mockedSaveSettings).not.toHaveBeenCalled();

    act(() => result.current.updateSettings({ streakAlert: false }));

    await waitFor(() => expect(mockedSaveSettings).toHaveBeenCalledTimes(1));
    expect(mockedSaveSettings).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, streakAlert: false });
  });
});

// L2-06 (lecture) et L2-05 (écriture) côté réglages — même famille que les
// tests de goals-context.test.tsx, conséquences différentes : ici un repli
// silencieux sur DEFAULT_SETTINGS rebascule la langue, éteint le rappel
// quotidien et remet l'heure à 20:00, puis écrase la vraie configuration au
// premier réglage touché.
describe('échecs de persistance', () => {
  it('does not write over the stored settings after a failed initial read (L2-06)', async () => {
    mockedLoadSettings.mockResolvedValue({ value: DEFAULT_SETTINGS, ok: false });
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    act(() => result.current.settings.updateSettings({ dailyReminder: true }));
    // Laisse passer l'effet de sauvegarde avant d'affirmer qu'il n'a rien écrit.
    await act(async () => {});

    expect(mockedSaveSettings).not.toHaveBeenCalled();
  });

  it('surfaces a failed initial read through the storage status context (L2-06)', async () => {
    mockedLoadSettings.mockResolvedValue({ value: DEFAULT_SETTINGS, ok: false });

    const { result } = renderHook(() => useHarness(), { wrapper });

    await waitFor(() => expect(result.current.status.loadFailed).toBe(true));
  });

  it('surfaces a failed write through the storage status context (L2-05)', async () => {
    mockedLoadSettings.mockResolvedValue({ value: DEFAULT_SETTINGS, ok: true });
    mockedSaveSettings.mockResolvedValue(false);
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    act(() => result.current.settings.updateSettings({ streakAlert: false }));

    await waitFor(() => expect(result.current.status.saveFailed).toBe(true));
  });
});

// Pendant côté réglages de la porte de sortie de l'import (voir
// describe('replaceAllGoals — import explicite') dans goals-context.test.tsx).
// importSettings est une fonction distincte d'updateSettings, et pas un
// paramètre de cette dernière : l'import réutilisait updateSettings, qui est
// aussi la fonction appelée par tous les toggles de NotificationsSection et
// LanguageSection — la faire passer outre readFailed rouvrirait L2-06 pour
// n'importe quel réglage touché après un échec de lecture.
describe('importSettings', () => {
  const imported: Settings = {
    ...DEFAULT_SETTINGS,
    dailyReminder: true,
    reminderTime: '07:00',
    language: 'en',
  };

  function renderHarnessWith(loadOk: boolean) {
    mockedLoadSettings.mockResolvedValue({ value: DEFAULT_SETTINGS, ok: loadOk });
    return renderHook(() => useHarness(), { wrapper });
  }

  // Chemin courant, sans échec de lecture : l'import écrit désormais
  // lui-même au lieu de laisser faire l'effet, donc ce cas change aussi.
  it('persists an ordinary import exactly once', async () => {
    const { result } = renderHarnessWith(true);
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    act(() => result.current.settings.importSettings(imported));
    await act(async () => {});

    expect(mockedSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockedSaveSettings).toHaveBeenCalledWith(imported);
  });

  it('writes imported settings even though the initial read failed', async () => {
    const { result } = renderHarnessWith(false);
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    act(() => result.current.settings.importSettings(imported));
    await act(async () => {});

    expect(mockedSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockedSaveSettings).toHaveBeenCalledWith(imported);
  });

  it('clears the read failure once the explicit write succeeds', async () => {
    const { result } = renderHarnessWith(false);
    await waitFor(() => expect(result.current.status.loadFailed).toBe(true));

    act(() => result.current.settings.importSettings(imported));

    await waitFor(() => expect(result.current.status.loadFailed).toBe(false));
  });

  it('resumes automatic saves once the explicit write succeeds', async () => {
    const { result } = renderHarnessWith(false);
    await waitFor(() => expect(result.current.status.loadFailed).toBe(true));

    act(() => result.current.settings.importSettings(imported));
    await waitFor(() => expect(result.current.status.loadFailed).toBe(false));
    expect(mockedSaveSettings).toHaveBeenCalledTimes(1);

    act(() => result.current.settings.updateSettings({ streakAlert: false }));

    await waitFor(() => expect(mockedSaveSettings).toHaveBeenCalledTimes(2));
  });

  it('reports a failed import write and keeps the read failure', async () => {
    const { result } = renderHarnessWith(false);
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));
    mockedSaveSettings.mockResolvedValue(false);

    act(() => result.current.settings.importSettings(imported));

    await waitFor(() => expect(result.current.status.saveFailed).toBe(true));
    expect(result.current.status.loadFailed).toBe(true);
  });

  // Le garde-fou de L2-06 : la porte de sortie est réservée à l'import.
  it('leaves updateSettings blocked after a failed read', async () => {
    const { result } = renderHarnessWith(false);
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    act(() => result.current.settings.updateSettings({ dailyReminder: true }));
    await act(async () => {});

    expect(mockedSaveSettings).not.toHaveBeenCalled();
  });
});
