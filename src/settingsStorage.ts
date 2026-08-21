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

// dailyReminder/goalReachedNotifs démarrent désactivés (opt-in), contrairement
// au prototype (qui les avait à true, mais sans vraies notifications
// derrière). Maintenant qu'ils déclenchent de vraies notifications système,
// les laisser à true par défaut demanderait la permission dès le premier
// lancement de l'app (ReminderScheduler tourne en fond dès que dailyReminder
// est actif) — l'inverse de ce qu'on veut (demander au moment où
// l'utilisateur active le toggle, voir app/settings.tsx). almostThereNotifs
// ne pilote qu'une bannière in-app (aucune permission requise) et
// streakAlert ne fait que changer le contenu du rappel quotidien une fois
// que celui-ci est déjà actif : les deux peuvent rester à true sans ce souci.
export const DEFAULT_SETTINGS: Settings = {
  dailyReminder: false,
  reminderTime: '20:00',
  goalReachedNotifs: false,
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
