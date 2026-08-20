import AsyncStorage from '@react-native-async-storage/async-storage';
import { Goal } from './types';

const GOALS_KEY = 'goals';

// AsyncStorage est l'équivalent RN de localStorage : stockage clé/valeur
// persistant sur l'appareil, mais toute l'API est asynchrone (Promises)
// car elle passe par le système de fichiers natif du téléphone.
export async function loadGoals(): Promise<Goal[]> {
  const raw = await AsyncStorage.getItem(GOALS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Écrase tout le tableau à chaque appel (pas de fusion/diff) : suffisant
// vu le faible volume de données attendu pour cette app.
export async function saveGoals(goals: Goal[]): Promise<void> {
  await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}
