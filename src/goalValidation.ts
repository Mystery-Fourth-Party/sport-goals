// Validation pure des champs du formulaire d'objectif, partagée par l'écran
// Création (src/components/GoalForm.tsx) et l'écran Édition
// (app/goal/[id]/edit.tsx) — les deux appliquaient la même règle en double,
// chacun avec sa propre expression inline. Pure et testée, comme toute
// logique de validation (voir AGENTS.md) : aucun accès natif, aucun t() ici,
// les messages d'erreur restent côté écran.

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
