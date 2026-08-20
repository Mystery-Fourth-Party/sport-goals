export type Unit = 'reps' | 'km' | 'min' | 'h';

export interface Goal {
  id: string;
  title: string;
  targetValue: number;
  // Progression actuelle vers targetValue (même unité). Alimentée par
  // GoalItem via le bouton "Ajouter" ; peut dépasser targetValue
  // (objectif dépassé), la barre de progression se contente de la clamper.
  currentValue: number;
  unit: Unit;
  createdAt: string;
  deadline: string;
}

// Traductions FR affichées à la place des clés techniques ('reps', 'km'...).
export const UNIT_LABELS: Record<Unit, string> = {
  reps: 'répétitions',
  km: 'km',
  min: 'minutes',
  h: 'heures',
};
