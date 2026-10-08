// Valeurs de départ du formulaire de création, dérivées d'un objectif
// existant. Utilisé par l'écran Création quand il relance un objectif clos
// (app/create.tsx) et par GoalForm, qui les prend en entrée. Ne décide pas
// si l'objectif source est relançable : c'est le rôle de l'écran.
import { goalDurationDays } from './stats';
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

// La durée reprend la durée totale d'origine (voir goalDurationDays), pas les
// jours restants : sur un objectif clos ils valent 0.
// Pas de plafonnement à MAX_GOAL_DAYS : rogner en silence changerait la durée
// voulue, la validation du formulaire refuse la valeur avec son message.
// `reminderEnabled` absent vaut true (voir types.ts), comme à la création.
export function goalToFormValues(goal: Goal, today: string): GoalFormValues {
  return {
    title: goal.title,
    targetValue: String(goal.targetValue),
    unit: goal.unit,
    durationDays: String(goalDurationDays(goal, today)),
    reminderEnabled: goal.reminderEnabled ?? true,
    reminderTime: goal.reminderTime,
    remindAfterReached: goal.remindAfterReached ?? false,
  };
}
