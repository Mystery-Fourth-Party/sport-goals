import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { SettingsProvider, useSettings } from './settings-context';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './settingsStorage';

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
  return <SettingsProvider>{children}</SettingsProvider>;
}

beforeEach(() => {
  mockedLoadSettings.mockReset();
  mockedSaveSettings.mockReset();
});

describe('SettingsProvider', () => {
  it('exposes DEFAULT_SETTINGS and loaded: false before loadSettings resolves', () => {
    // Promesse jamais résolue dans ce test : on observe uniquement l'état
    // affiché avant toute résolution, pas ce qui se passe après.
    mockedLoadSettings.mockReturnValue(new Promise<Settings>(() => {}));

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.loaded).toBe(false);
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('exposes loaded: true and the loaded settings once loadSettings resolves', async () => {
    const loaded: Settings = { ...DEFAULT_SETTINGS, dailyReminder: true, reminderTime: '07:30' };
    mockedLoadSettings.mockResolvedValue(loaded);

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.settings).toEqual(loaded);
  });

  it('updateSettings merges partially instead of replacing', async () => {
    mockedLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.updateSettings({ dailyReminder: true }));

    expect(result.current.settings).toEqual({ ...DEFAULT_SETTINGS, dailyReminder: true });
  });

  it('calls saveSettings with the merged result after a post-load change, but not on the load itself', async () => {
    mockedLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
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
