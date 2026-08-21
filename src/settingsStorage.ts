import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  dailyReminder: boolean;
  // "HH:mm", éditée en texte libre (pas de vrai time picker pour l'instant).
  reminderTime: string;
  goalReachedNotifs: boolean;
  // Pilote la bannière "Presque là !" de l'écran Détail (voir
  // app/goal/[id].tsx) — pas seulement l'affichage sur cet écran.
  almostThereNotifs: boolean;
  streakAlert: boolean;
}

// Mêmes valeurs par défaut que SettingsScreen dans le prototype.
export const DEFAULT_SETTINGS: Settings = {
  dailyReminder: true,
  reminderTime: '20:00',
  goalReachedNotifs: true,
  almostThereNotifs: true,
  streakAlert: true,
};

const SETTINGS_KEY = 'settings';

// Même pattern défensif que storage.ts (loadGoals/saveGoals) : JSON
// corrompu ou lecture en échec retombent sur les valeurs par défaut
// plutôt que de faire planter l'app.
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Fusionné avec DEFAULT_SETTINGS : un réglage ajouté après coup (comme
    // entries pour Goal) doit avoir une valeur plutôt que undefined.
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    console.error('loadSettings: échec du chargement, retour aux valeurs par défaut.', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<boolean> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('saveSettings: échec de la sauvegarde.', error);
    return false;
  }
}
