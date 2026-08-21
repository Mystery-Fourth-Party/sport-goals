import AsyncStorage from '@react-native-async-storage/async-storage';
import { Goal } from './types';

const GOALS_KEY = 'goals';

// AsyncStorage est l'équivalent RN de localStorage : stockage clé/valeur
// persistant sur l'appareil, mais toute l'API est asynchrone (Promises)
// car elle passe par le système de fichiers natif du téléphone.
//
// Si la valeur stockée est corrompue (JSON invalide) ou si la lecture
// échoue, on retombe sur un tableau vide plutôt que de laisser
// l'exception remonter et faire planter l'app au démarrage.
export async function loadGoals(): Promise<Goal[]> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_KEY);
    if (!raw) return [];
    const goals: Goal[] = JSON.parse(raw);
    // Les objectifs enregistrés avant l'ajout de currentValue n'ont pas ce
    // champ ; sans ce fallback il vaudrait undefined, cassant la barre de
    // progression (NaN) et corrompant l'objectif au premier ajout de progression.
    return goals.map((g) => ({ ...g, currentValue: g.currentValue ?? 0 }));
  } catch (error) {
    console.error('loadGoals: échec du chargement, retour à une liste vide.', error);
    return [];
  }
}

// Écrase tout le tableau à chaque appel (pas de fusion/diff) : suffisant
// vu le faible volume de données attendu pour cette app.
//
// Renvoie un booléen (plutôt que de laisser l'exception remonter) pour que
// l'UI puisse informer l'utilisateur d'un échec d'écriture si besoin.
export async function saveGoals(goals: Goal[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    return true;
  } catch (error) {
    console.error('saveGoals: échec de la sauvegarde.', error);
    return false;
  }
}
