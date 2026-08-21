import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settingsStorage';

const SETTINGS_KEY = 'settings';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('DEFAULT_SETTINGS', () => {
  // dailyReminder/goalReachedNotifs doivent rester opt-in : à true par
  // défaut, ReminderScheduler demanderait la permission dès le premier
  // lancement de l'app plutôt qu'au moment où l'utilisateur active le
  // toggle (voir le commentaire dans settingsStorage.ts et app/settings.tsx).
  it('starts dailyReminder and goalReachedNotifs disabled', () => {
    expect(DEFAULT_SETTINGS.dailyReminder).toBe(false);
    expect(DEFAULT_SETTINGS.goalReachedNotifs).toBe(false);
  });
});

describe('loadSettings', () => {
  it('returns the defaults when nothing is stored', async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('returns the settings previously saved', async () => {
    const custom = { ...DEFAULT_SETTINGS, dailyReminder: true, reminderTime: '07:30' };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(custom));

    await expect(loadSettings()).resolves.toEqual(custom);
  });

  it('falls back to the defaults when the stored JSON is corrupted', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, '{not valid json');

    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to the defaults when reading from storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));

    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('fills in a setting added after the fact with its default', async () => {
    const { streakAlert, ...legacy } = DEFAULT_SETTINGS;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(legacy));

    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  it('persists the settings and returns true on success', async () => {
    const custom = { ...DEFAULT_SETTINGS, streakAlert: false };
    await expect(saveSettings(custom)).resolves.toBe(true);

    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    expect(JSON.parse(raw as string)).toEqual(custom);
  });

  it('returns false and does not throw when writing fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('write failed'));

    await expect(saveSettings(DEFAULT_SETTINGS)).resolves.toBe(false);
  });
});
