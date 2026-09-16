import AsyncStorage from '@react-native-async-storage/async-storage';
import { Goal } from './types';

const GOALS_KEY = 'goals';

// Résultat d'une lecture. `value` est toujours renseignée — les données lues,
// ou le repli — pour que l'appelant ait quelque chose à afficher dans tous
// les cas. `ok` porte la distinction que le type de retour précédent (la
// valeur nue) rendait impossible : « rien de stocké », repli parfaitement
// légitime, contre « lecture impossible », où le disque contient peut-être
// encore des données valides. Sur `ok: false`, l'appelant ne doit pas écrire
// par-dessus (voir goals-context.tsx / settings-context.tsx).
export interface LoadResult<T> {
  value: T;
  ok: boolean;
}

// AsyncStorage est l'équivalent RN de localStorage : stockage clé/valeur
// persistant sur l'appareil, mais toute l'API est asynchrone (Promises)
// car elle passe par le système de fichiers natif du téléphone.
//
// Si la valeur stockée est corrompue (JSON invalide) ou si la lecture
// échoue, on retombe sur un tableau vide plutôt que de laisser l'exception
// remonter et faire planter l'app au démarrage — mais avec `ok: false`,
// pour que l'appelant sache que ce vide n'est pas une réponse du stockage.
export async function loadGoals(): Promise<LoadResult<Goal[]>> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_KEY);
    if (!raw) return { value: [], ok: true };
    const goals: Goal[] = JSON.parse(raw);
    // Les objectifs enregistrés avant l'ajout d'entries n'ont pas ce champ ;
    // sans ce fallback il vaudrait undefined, faisant planter le premier
    // .reduce()/.find() dans stats.ts.
    return { value: goals.map((g) => ({ ...g, entries: g.entries ?? [] })), ok: true };
  } catch (error) {
    console.error('loadGoals: échec du chargement, retour à une liste vide.', error);
    return { value: [], ok: false };
  }
}

// Écrase tout le tableau à chaque appel (pas de fusion/diff) : suffisant
// vu le faible volume de données attendu pour cette app.
//
// Renvoie un booléen (plutôt que de laisser l'exception remonter) pour que
// l'UI puisse informer l'utilisateur d'un échec d'écriture. GoalsProvider le
// transmet à storage-status.tsx, que StorageStatusBanner affiche.
export async function saveGoals(goals: Goal[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    return true;
  } catch (error) {
    console.error('saveGoals: échec de la sauvegarde.', error);
    return false;
  }
}
