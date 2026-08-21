export type Unit = 'reps' | 'km' | 'min' | 'h';

// Une entrée de progression pour un jour donné ("YYYY-MM-DD" — même format
// que les clés utilisées par stats.ts pour l'historique et le streak).
// Si l'utilisateur ajoute plusieurs fois de la progression le même jour,
// les valeurs s'additionnent dans l'entrée existante plutôt que d'empiler
// plusieurs entrées pour la même date.
export interface Entry {
  date: string;
  value: number;
}

export interface Goal {
  id: string;
  title: string;
  targetValue: number;
  // Progression actuelle vers targetValue (même unité). Alimentée par
  // GoalItem via le bouton "Ajouter" ; peut dépasser targetValue
  // (objectif dépassé), la barre de progression se contente de la clamper.
  //
  // Conservé tel quel pour l'instant (App/GoalForm/GoalItem le lisent et
  // l'écrivent encore) le temps de brancher ces écrans sur `entries` ;
  // à terme il devrait être dérivé de la somme de `entries` plutôt que
  // maintenu comme compteur séparé, pour éviter deux sources de vérité.
  currentValue: number;
  unit: Unit;
  createdAt: string;
  deadline: string;
  // Historique quotidien de progression, consommé par stats.ts
  // (getGoalStats/calcStreak/getWeeklyStats) pour calculer le rythme, le
  // streak et le résumé hebdomadaire. `createdAt`/`deadline` font déjà
  // office de startDate/endDate (voir stats.ts) : pas de champs dédiés
  // supplémentaires pour éviter de dupliquer la même information sous deux
  // noms différents.
  //
  // Optionnel pour l'instant : GoalForm ne le renseigne pas encore à la
  // création (hors scope de cette étape). storage.ts le normalise déjà à
  // [] au chargement ; à rendre requis une fois GoalForm/GoalItem branchés
  // sur les entries.
  entries?: Entry[];
}

// Traductions FR affichées à la place des clés techniques ('reps', 'km'...).
export const UNIT_LABELS: Record<Unit, string> = {
  reps: 'répétitions',
  km: 'km',
  min: 'minutes',
  h: 'heures',
};
