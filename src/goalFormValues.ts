// Valeurs de départ du formulaire de création, dérivées d'un objectif
// existant. Utilisé par l'écran Création quand il relance un objectif clos
// (app/create.tsx) et par GoalForm, qui les prend en entrée. Ne décide pas
// si l'objectif source est relançable : c'est le rôle de l'écran.
import { getGoalStats } from './stats';
import { Goal, Unit } from './types';

// Les champs texte sont des chaînes, comme les useState de GoalForm : la
// saisie reste contrôlée, la validation se fait à la soumission.
export interface GoalFormValues {
  title: string;
  targetValue: string;
  unit: Unit;
  durationDays: string;
  reminderEnabled: boolean;
  reminderTime: string | undefined;
  remindAfterReached: boolean;
}

// La durée reprend la durée totale d'origine (création → échéance), pas les
// jours restants : sur un objectif clos ils valent 0. Plancher à 1 pour qu'un
// objectif dont l'échéance tombe le jour de sa création reste soumettable.
// Pas de plafonnement à MAX_GOAL_DAYS : rogner en silence changerait la durée
// voulue, la validation du formulaire refuse la valeur avec son message.
// `reminderEnabled` absent vaut true (voir types.ts), comme à la création.
export function goalToFormValues(goal: Goal, today: string): GoalFormValues {
  const { totalDays } = getGoalStats(goal, today);
  return {
    title: goal.title,
    targetValue: String(goal.targetValue),
    unit: goal.unit,
    durationDays: String(Math.max(1, totalDays)),
    reminderEnabled: goal.reminderEnabled ?? true,
    reminderTime: goal.reminderTime,
    remindAfterReached: goal.remindAfterReached ?? false,
  };
}
