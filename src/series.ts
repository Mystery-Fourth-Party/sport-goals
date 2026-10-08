// Règles pures de la répétition automatique : quelle occurrence d'une série fait
// foi, quand en créer la suivante, et ce que devient la coche à la suppression.
// Utilisé par GoalsProvider (goals-context.tsx) seulement ; aucun accès au
// stockage, à l'horloge ni à un générateur d'id : tout arrive en paramètre.
// Ne décide pas du moment d'exécution, qui est celui de l'effet du provider.
import { MAX_GOAL_DAYS } from './goalValidation';
import { deadlineAfterDays, goalDurationDays, isGoalClosed } from './stats';
import { Goal } from './types';

// Date illisible = la plus ancienne possible : une occurrence aux dates
// corrompues ne peut pas passer pour la dernière de sa série.
function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? -Infinity : t;
}

// Ordre total, indépendant de l'ordre du tableau : échéance, puis création,
// puis id. Les deux derniers critères ne servent qu'à rendre le choix
// déterministe quand des données importées se chevauchent.
function isLater(a: Goal, b: Goal): boolean {
  const aDeadline = time(a.deadline);
  const bDeadline = time(b.deadline);
  if (aDeadline !== bDeadline) return aDeadline > bDeadline;
  const aCreated = time(a.createdAt);
  const bCreated = time(b.createdAt);
  if (aCreated !== bCreated) return aCreated > bCreated;
  return a.id > b.id;
}

// La pointe de chaque série : l'occurrence à l'échéance la plus récente. Elle
// seule peut en faire naître une suivante, et c'est sa coche qui décide — une
// ancienne occurrence qui porterait encore `repeat` après un import incohérent
// n'est jamais regardée. Décocher la pointe arrête donc la série, quoi que
// disent les autres. Un objectif sans seriesId (ou à seriesId vide) n'appartient
// à aucune série.
function seriesTips(goals: Goal[]): Map<string, Goal> {
  const tips = new Map<string, Goal>();
  for (const goal of goals) {
    if (!goal.seriesId) continue;
    const tip = tips.get(goal.seriesId);
    if (tip === undefined || isLater(goal, tip)) tips.set(goal.seriesId, goal);
  }
  return tips;
}

function nextOccurrence(
  tip: Goal,
  seriesId: string,
  today: string,
  now: Date,
  newId: () => string,
) {
  const days = goalDurationDays(tip, today);
  // Dates de création illisibles : la durée d'origine est inconnue, et en
  // inventer une serait écrire sur le disque une donnée que personne n'a
  // choisie. La série reste telle quelle.
  if (!Number.isFinite(days)) return null;
  // Plafonné ici, contrairement à goalToFormValues qui laisse la durée
  // dépasser pour que le formulaire la refuse avec son message : il n'y a pas
  // de formulaire ni d'utilisateur pour corriger une création automatique.
  // Seules des données corrompues peuvent atteindre ce plafond, la création,
  // la modification et l'import le faisant déjà respecter.
  const duration = Math.min(days, MAX_GOAL_DAYS);
  const next: Goal = {
    id: newId(),
    title: tip.title,
    targetValue: tip.targetValue,
    unit: tip.unit,
    createdAt: now.toISOString(),
    deadline: deadlineAfterDays(now, duration),
    entries: [],
    ...(tip.reminderEnabled !== undefined ? { reminderEnabled: tip.reminderEnabled } : {}),
    ...(tip.reminderTime !== undefined ? { reminderTime: tip.reminderTime } : {}),
    ...(tip.remindAfterReached !== undefined ? { remindAfterReached: tip.remindAfterReached } : {}),
    repeat: true,
    seriesId,
  };
  return next;
}

// Crée l'occurrence suivante de chaque série dont la pointe répète et est
// close. Une seule par série, qui démarre à `now` quel que soit le retard :
// pas d'occurrences vides intermédiaires. Dans le même résultat, `repeat`
// quitte toutes les occurrences de la série — pas seulement la pointe : la
// coche n'est portée que par l'occurrence en cours, c'est ce qui empêche de
// recréer la même. Rend `goals` lui-même, même référence, quand il n'y a rien
// à faire : l'appelant n'a alors ni rendu ni écriture, et un second passage
// sur le résultat ne crée rien (idempotence).
//
// Les occurrences créées se placent en tête, comme createGoal.
export function advanceSeries(
  goals: Goal[],
  today: string,
  now: Date,
  newId: () => string,
): Goal[] {
  const created: Goal[] = [];
  const handedOver = new Set<string>();

  for (const [seriesId, tip] of seriesTips(goals)) {
    if (tip.repeat !== true || !isGoalClosed(tip, today)) continue;
    const next = nextOccurrence(tip, seriesId, today, now, newId);
    if (next === null) continue;
    created.push(next);
    handedOver.add(seriesId);
  }

  if (created.length === 0) return goals;
  return [
    ...created,
    ...goals.map((goal) =>
      goal.seriesId !== undefined && handedOver.has(goal.seriesId) && goal.repeat === true
        ? { ...goal, repeat: false }
        : goal,
    ),
  ];
}

// Retire une occurrence. Quand c'est la pointe de sa série, `repeat` quitte
// aussi les autres occurrences : sans cela, après un import incohérent, une
// ancienne occurrence qui porte encore la coche deviendrait la nouvelle pointe
// et relancerait la série, alors que supprimer l'occurrence en cours doit
// l'arrêter. Supprimer une occurrence archivée, elle, ne touche à rien : la
// série en cours continue.
export function removeGoal(goals: Goal[], goalId: string): Goal[] {
  const target = goals.find((goal) => goal.id === goalId);
  const rest = goals.filter((goal) => goal.id !== goalId);
  const seriesId = target?.seriesId;
  if (!seriesId || seriesTips(goals).get(seriesId) !== target) return rest;
  return rest.map((goal) =>
    goal.seriesId === seriesId && goal.repeat === true ? { ...goal, repeat: false } : goal,
  );
}
