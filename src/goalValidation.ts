// Validation pure des champs numériques saisis, partagée par l'écran
// Création (src/components/GoalForm.tsx), l'écran Édition
// (app/goal/[id]/edit.tsx) et la modale de séance (app/goal/[id].tsx) —
// chacun appliquait la même règle en double, avec sa propre expression
// inline. Pure et testée, comme toute
// logique de validation (voir AGENTS.md) : aucun accès natif, aucun t() ici,
// les messages d'erreur restent côté écran.

// Durée totale maximale d'un objectif, de la création à l'échéance. Sans
// plafond, une durée entière démesurée (1e9) passe parseDurationDays, puis
// setDate sort de la plage des dates JS et toISOString lève une RangeError.
// Appliquée à la création (GoalForm), à la modification (EditGoalForm, où
// elle borne « Jours restants » à ce qui reste de ce total, voir
// maxRemainingDays) et à l'import (findGoalInconsistency dans backup.ts).
export const MAX_GOAL_DAYS = 365;

// Plus grand nombre de « Jours restants » acceptable à la modification.
// Enregistrer recalcule l'échéance depuis aujourd'hui : la durée totale
// devient jours écoulés + jours restants, qui doit tenir dans MAX_GOAL_DAYS.
// Peut valoir 0 le jour de l'échéance d'un objectif de 365 jours : il n'est
// alors plus prolongeable, et l'écran affiche l'erreur.
export function maxRemainingDays(elapsedDays: number): number {
  return Math.max(0, MAX_GOAL_DAYS - elapsedDays);
}

// Retourne le nombre de jours saisi, ou null si la saisie ne peut pas donner
// une échéance postérieure au jour de création.
//
// Le nombre entier est exigé, pas seulement une valeur positive : les deux
// écrans construisent la deadline avec `date.setDate(date.getDate() + n)`,
// et setDate tronque la fraction. Une durée de 0.5 passait donc le contrôle
// `Number(x) > 0` et produisait une échéance le jour même — un objectif de
// durée nulle, que getGoalStats affiche "en avance" (expectedProgress forcé
// à 0). C'est le cas C4 du jeu de test, qu'on croyait atteignable seulement
// par un import.
export function parseDurationDays(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const days = Number(trimmed);
  if (!Number.isInteger(days) || days <= 0) return null;
  return days;
}

// Retourne le nombre saisi s'il est fini et strictement positif, sinon null.
// Sert pour la valeur cible d'un objectif et pour la valeur d'une séance.
//
// R2 — les trois écrans ne testaient que `Number(x) > 0`. Number('1e400')
// vaut Infinity, qui passe ce test : la valeur était enregistrée, puis
// JSON.stringify l'écrivait null à l'export, et l'import rejetait alors le
// fichier entier (isValidGoal/isValidEntry exigent un number). Même garde
// que celle posée côté import par L1-12 (voir backup.ts).
//
// Pour la valeur d'une séance, cette garde d'écran n'est pas la seule :
// addProgress et updateEntry (src/goals-context.tsx) appliquent la même
// règle, et c'est la leur qui fait foi quel que soit l'appelant. Celle-ci
// sert à afficher l'erreur au lieu d'ignorer la saisie.
export function parsePositiveNumber(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
