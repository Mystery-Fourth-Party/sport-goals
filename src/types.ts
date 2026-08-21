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
  unit: Unit;
  createdAt: string;
  deadline: string;
  // Historique quotidien de progression, consommé par stats.ts
  // (getGoalStats/calcStreak/getWeeklyStats) pour calculer la progression
  // actuelle, le rythme, le streak et le résumé hebdomadaire — plus de
  // compteur `currentValue` séparé : une seule source de vérité.
  // `createdAt`/`deadline` font déjà office de startDate/endDate (voir
  // stats.ts) : pas de champs dédiés supplémentaires pour éviter de
  // dupliquer la même information sous deux noms différents.
  entries: Entry[];
}

// Traductions FR affichées à la place des clés techniques ('reps', 'km'...).
export const UNIT_LABELS: Record<Unit, string> = {
  reps: 'répétitions',
  km: 'km',
  min: 'minutes',
  h: 'heures',
};

// Icône par unité (voir design-tokens.md § Composants réutilisables —
// GoalCard). Purement visuel, à côté de UNIT_LABELS plutôt que dans
// theme.ts : c'est une table totale sur `Unit`, comme UNIT_LABELS.
export const UNIT_ICONS: Record<Unit, string> = {
  reps: '💪',
  km: '🏃',
  min: '⏱',
  h: '⏳',
};
