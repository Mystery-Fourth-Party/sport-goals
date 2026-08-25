export type Unit = 'reps' | 'km' | 'min' | 'h';

export const UNITS: Unit[] = ['reps', 'km', 'min', 'h'];

// Une entrée de progression pour un jour donné ("YYYY-MM-DD" — même format
// que les clés utilisées par stats.ts pour l'historique et le streak).
// Si l'utilisateur ajoute plusieurs fois de la progression le même jour,
// les valeurs s'additionnent dans l'entrée existante plutôt que d'empiler
// plusieurs entrées pour la même date.
export interface Entry {
  date: string;
  value: number;
  // Horodatage ISO du dernier enregistrement sur cette entrée (création ou
  // correction) — pas sa date "métier" (`date` ci-dessus, qui reste la clé
  // utilisée partout : fusion du jour, streak, ongoingGoalsWithoutTodayEntry...).
  // Optionnel : les entrées créées avant l'introduction de ce champ n'en ont
  // pas, sans valeur inventée ni migration au chargement (voir storage.ts).
  recordedAt?: string;
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
  // "HH:mm" — absent = hérite de settings.reminderTime (voir
  // notifications.ts, groupPendingGoalsByReminderTime).
  reminderTime?: string;
  // Absent = équivalent à true (rappels actifs par défaut, cohérent avec le
  // comportement actuel où tout objectif en cours est rappelé). Gouverne
  // uniquement le rappel quotidien — ne touche pas goalReachedNotifs ni
  // almostThereNotifs, réglages globaux sans lien avec ce champ (voir
  // ongoingGoalsWithoutTodayEntry).
  reminderEnabled?: boolean;
}

// Le libellé affiché à la place des clés techniques ('reps', 'km'...) vit
// désormais dans les traductions (clés unit.reps/unit.km/unit.min/unit.h,
// voir src/i18n/locales/*.json), résolu via t() aux points d'usage plutôt
// que par une table statique ici.

// Icône par unité (voir design-tokens.md § Composants réutilisables —
// GoalCard). Purement visuel, à côté de UNIT_LABELS plutôt que dans
// theme.ts : c'est une table totale sur `Unit`, comme UNIT_LABELS.
export const UNIT_ICONS: Record<Unit, string> = {
  reps: '💪',
  km: '🏃',
  min: '⏱',
  h: '⏳',
};
