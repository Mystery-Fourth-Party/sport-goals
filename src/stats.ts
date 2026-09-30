// Logique de calcul portée depuis le prototype Figma Make
// (design-reference/stats-logic.ts), adaptée au type Goal réel de
// sport-goals : `target`/`startDate`/`endDate` du prototype deviennent
// `targetValue`/`createdAt`/`deadline` (déjà présents sur Goal, voir
// src/types.ts) plutôt que d'introduire des champs dupliqués. `createdAt`/
// `deadline` sont des chaînes ISO complètes (`Date.toISOString()`), alors
// que ce module raisonne en dates "YYYY-MM-DD" (comme le prototype) : voir
// `toDayStr` ci-dessous. Fonctions pures, `today` toujours passé en
// paramètre (jamais lu via `new Date()` à l'intérieur) pour rester
// testables ; `todayStr()` fournit la vraie date du jour pour les appelants.
import i18n from './i18n';
import { Entry, Goal } from './types';

// Pendant la durée de l'objectif : not-started / ahead / on-track / late
// sous 100 %, reached à 100 %, exceeded au-delà. Une fois clos (voir
// isGoalClosed) : reached / exceeded / failed selon la progression finale.
export type Status =
  'ahead' | 'on-track' | 'late' | 'not-started' | 'reached' | 'exceeded' | 'failed';

export interface GoalStats {
  actual: number;
  progress: number;
  expectedProgress: number;
  dailyRequired: number;
  dailyAvg: number;
  status: Status;
  streak: number;
  remainingDays: number;
  elapsedDays: number;
  totalDays: number;
}

export interface DaySessionCount {
  date: string;
  count: number;
}

export interface WeeklyStats {
  weekDates: string[];
  sessionsPerDay: DaySessionCount[];
  activeDays: number;
  totalSessions: number;
  mostAdvanced: { goal: Goal; stats: GoalStats } | undefined;
  mostBehind: { goal: Goal; stats: GoalStats } | undefined;
  // Clos cette semaine, statut final reached / exceeded / failed ; voir
  // getWeeklyStats pour la fenêtre et le tri.
  closedThisWeek: { goal: Goal; stats: GoalStats }[];
}

// ─── Dates ──────────────────────────────────────────────────────────────

// Jour calendaire *local* de l'instant. createdAt/deadline sont des chaînes
// ISO écrites par toISOString(), donc en UTC : en trancher les 10 premiers
// caractères donnait le jour UTC, alors que todayStr() lit le calendrier
// local. getGoalStats comparait ainsi deux bases différentes, décalant d'un
// jour la durée, les jours restants et le statut d'un objectif créé ou
// échéant près de minuit (L1-01). Le format stocké ne change pas — seule
// son interprétation, qui rejoint désormais le jour que l'utilisateur avait
// sous les yeux au moment de la saisie.
function toDayStr(iso: string): string {
  return dateStr(new Date(iso));
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// Date du jour réelle au format "YYYY-MM-DD", à passer aux fonctions
// ci-dessous plutôt qu'une constante figée (contrairement au prototype).
export function todayStr(): string {
  return dateStr(new Date());
}

// ─── Clôture et seuil de 100 % ─────────────────────────────────────────

// Seul endroit où se décide qu'un objectif est clos : les écrans, le
// rappel et l'archive passent tous par ici plutôt que de comparer des
// dates eux-mêmes. L'objectif reste actif pendant tout le jour local de
// l'échéance et se clôt au jour suivant. Comparaison de chaînes : le
// format YYYY-MM-DD se trie dans l'ordre chronologique.
export function isGoalClosed(goal: Goal, today: string): boolean {
  return today > toDayStr(goal.deadline);
}

// Progression arrondie à 6 décimales avant toute comparaison à 100 % :
// 3 × 0,1 km sur une cible de 0,3 km donne 1.0000000000000002 en flottant,
// qui passerait pour « dépassé ». Même arrondi que l'écart au rythme
// attendu dans getGoalStats. addProgress (goals-context.tsx) détecte le
// franchissement de 100 % par le statut, donc sur cette même base.
export function roundProgress(progress: number): number {
  return Math.round(progress * 1e6) / 1e6;
}

// Cible atteinte ou dépassée, que l'objectif soit clos ou non. Lu par le
// rappel quotidien (ongoingGoalsWithoutTodayEntry) et par la détection du
// franchissement de 100 % (addProgress).
export function isSuccessStatus(status: Status): boolean {
  return status === 'reached' || status === 'exceeded';
}

// ─── Calcul principal par objectif ─────────────────────────────────────
// Débloque : moyenne quotidienne, recalcul dynamique, alerte de retard, streak.

export function getGoalStats(goal: Goal, today: string): GoalStats {
  const entries = goal.entries ?? [];
  const todayDate = parseDate(today);
  const start = parseDate(toDayStr(goal.createdAt));
  const end = parseDate(toDayStr(goal.deadline));

  const totalDays = diffDays(start, end);
  const elapsedDays = Math.max(0, Math.min(diffDays(start, todayDate), totalDays));
  const remainingDays = Math.max(0, diffDays(todayDate, end));

  const actual = entries.reduce((sum, e) => sum + e.value, 0);
  // Pas de plafond ici : un objectif dépassé doit pouvoir afficher >100%.
  // Le plafonnement visuel de la barre de progression vit dans ProgressBar
  // (largeur à l'écran), pas dans ce calcul.
  const progress = goal.targetValue > 0 ? actual / goal.targetValue : 0;
  // Sur une durée nulle (createdAt === deadline, atteignable par import),
  // la fenêtre tient dans une seule journée : elle est entièrement écoulée
  // dès que ce jour est arrivé, donc 100 % est attendu. Le repli à 0
  // rendait le statut "late" inatteignable quelle que soit la progression
  // réelle (L1-10).
  const expectedProgress =
    totalDays > 0 ? elapsedDays / totalDays : diffDays(start, todayDate) >= 0 ? 1 : 0;
  // Plancher à 0 : au-delà de la cible (ou sur une cible nulle) la
  // soustraction devient négative, ce qui n'a pas de sens comme rythme
  // restant à tenir et se retrouverait tel quel dans l'UI et le libellé lu
  // de la carte (voir GoalCard, goalCard.lateRequiredA11y).
  //
  // Diviseur planché à 1 : à partir du jour de l'échéance, remainingDays
  // vaut 0 et le rythme de rattrapage retombait à 0 avec lui — un objectif
  // en retard annonçait 0 par jour au lieu de ce qu'il restait réellement à
  // faire (L1-02). Échéance atteinte ou dépassée, tout le reste est dû dans
  // la journée.
  const dailyRequired = Math.max(0, (goal.targetValue - actual) / Math.max(1, remainingDays));
  // Même raison que expectedProgress ci-dessus : sur une durée nulle, la
  // cible entière est due dans la seule journée disponible.
  const dailyAvg = totalDays > 0 ? goal.targetValue / totalDays : goal.targetValue;

  const rounded = roundProgress(progress);
  let status: Status;
  if (rounded > 1) {
    status = 'exceeded';
  } else if (rounded === 1) {
    status = 'reached';
  } else if (isGoalClosed(goal, today)) {
    status = 'failed';
  } else if (elapsedDays === 0 && actual === 0) {
    status = 'not-started';
  } else {
    // Arrondi avant comparaison : une progression pile sur un seuil produit
    // une différence flottante décalée d'un epsilon (0,05 devient
    // 0.050000000000000044, -0,1 devient -0.09999999999999998), ce qui
    // faisait basculer le statut sans que rien ne change à l'écran, où la
    // progression est affichée au point de pourcentage près. 6 décimales :
    // très en dessous de ce que l'utilisateur peut voir, très au-dessus de
    // l'erreur d'arrondi binaire.
    const diff = Math.round((progress - expectedProgress) * 1e6) / 1e6;
    if (diff > 0.05) status = 'ahead';
    else if (diff > -0.1) status = 'on-track';
    else status = 'late';
  }

  const streak = calcStreak(entries, today);

  return {
    actual,
    progress,
    expectedProgress,
    dailyRequired,
    dailyAvg,
    status,
    streak,
    remainingDays,
    elapsedDays,
    totalDays,
  };
}

// ─── Streak (jours consécutifs) ────────────────────────────────────────

export function calcStreak(entries: Entry[], today: string): number {
  const entryMap = new Map(entries.map((e) => [e.date, e.value]));
  let streak = 0;
  const d = parseDate(today);
  while (true) {
    const key = dateStr(d);
    const val = entryMap.get(key);
    if (val === undefined || val === 0) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ─── Actifs / clos ──────────────────────────────────────────────────────
// Partition sur la clôture et non sur le statut : un objectif atteint en
// avance reste sur l'accueil jusqu'à son échéance, un objectif échu part
// en archive quelle que soit sa progression. Dérivé à chaque appel, jamais
// stocké sur Goal : rien n'est à migrer, et une correction d'entrée se
// reflète d'elle-même.

export function splitGoalsByClosure(
  goals: Goal[],
  today: string,
): { active: Goal[]; closed: Goal[] } {
  const active: Goal[] = [];
  const closed: Goal[] = [];
  for (const g of goals) {
    if (isGoalClosed(g, today)) {
      closed.push(g);
    } else {
      active.push(g);
    }
  }
  return { active, closed };
}

// ─── Résumé hebdomadaire ────────────────────────────────────────────────

export function getWeeklyStats(goals: Goal[], today: string): WeeklyStats {
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = parseDate(today);
    d.setDate(d.getDate() - i);
    weekDates.push(dateStr(d));
  }

  const sessionsPerDay: DaySessionCount[] = weekDates.map((date) => ({
    date,
    count: goals.filter((g) => {
      const e = (g.entries ?? []).find((entry) => entry.date === date);
      return e && e.value > 0;
    }).length,
  }));

  const activeDays = sessionsPerDay.filter((d) => d.count > 0).length;
  const totalSessions = sessionsPerDay.reduce((sum, d) => sum + d.count, 0);

  // Les séances comptent tous les objectifs, clos compris : elles ont bien
  // eu lieu cette semaine. Les classements, eux, ne portent que sur les
  // objectifs encore en cours — un objectif clos n'a plus de rythme à tenir.
  // Même partition que la liste par objectif de app/weekly.tsx.
  const withStats = splitGoalsByClosure(goals, today).active.map((g) => ({
    goal: g,
    stats: getGoalStats(g, today),
  }));
  const mostAdvanced = [...withStats].sort((a, b) => b.stats.progress - a.stats.progress)[0];
  // Exclu des candidats au « plus en retard » : les deux cartes de
  // app/weekly.tsx sont rendues l'une sous l'autre, et sans cette exclusion
  // le même objectif pouvait s'y afficher deux fois sous deux titres
  // contradictoires — un objectif très avancé en progression brute peut
  // parfaitement être le plus en retard sur son propre rythme attendu
  // (L1-07).
  //
  // Avec un seul objectif il ne reste aucun candidat, donc mostBehind vaut
  // undefined et la garde {mostBehind && ...} de weekly.tsx fait disparaître
  // la carte. C'est le comportement voulu, et il tombe de la règle générale :
  // « le moins avancé » d'un ensemble d'un seul élément ne veut rien dire.
  const mostBehind = withStats
    .filter((w) => w.goal.id !== mostAdvanced?.goal.id)
    .sort(
      (a, b) =>
        a.stats.progress - a.stats.expectedProgress - (b.stats.progress - b.stats.expectedProgress),
    )[0];

  // Objectifs clos dont le jour local d'échéance tombe dans la fenêtre des
  // 7 jours. Un objectif reste ouvert pendant tout le jour de son échéance
  // (isGoalClosed) : échu aujourd'hui, il n'est pas encore ici mais dans la
  // liste des objectifs en cours ; clos, il y reste 6 jours, de J-1 à J-6.
  // Tri sur le jour d'échéance, le plus récent d'abord, et non sur
  // l'instant, comme la clôture. Array.prototype.sort est stable : à jour
  // égal, l'ordre de `goals` est conservé.
  const weekSet = new Set(weekDates);
  const closedThisWeek = splitGoalsByClosure(goals, today)
    .closed.map((g) => ({ goal: g, day: toDayStr(g.deadline) }))
    .filter(({ day }) => weekSet.has(day))
    .sort((a, b) => (a.day === b.day ? 0 : a.day < b.day ? 1 : -1))
    .map(({ goal }) => ({ goal, stats: getGoalStats(goal, today) }));

  return {
    weekDates,
    sessionsPerDay,
    activeDays,
    totalSessions,
    mostAdvanced,
    mostBehind,
    closedThisWeek,
  };
}

// ─── Formatage / libellés statut ───────────────────────────────────────

export function fmt(value: number, unit: Goal['unit']): string {
  if (unit === 'km') return value.toFixed(1);
  return Math.round(value).toString();
}

// Clés de traduction (voir src/i18n/locales/*.json) — statusLabel reste une
// fonction pure hors composant, appelée aussi bien depuis GoalCard que
// StatusBadge : lit directement l'instance i18next (pas de Hook disponible
// ici) plutôt que de forcer chaque appelant à lui passer `t`.
const STATUS_KEYS: Record<Status, string> = {
  ahead: 'status.ahead',
  'on-track': 'status.onTrack',
  late: 'status.late',
  'not-started': 'status.notStarted',
  reached: 'status.reached',
  exceeded: 'status.exceeded',
  failed: 'status.failed',
};

export function statusLabel(s: Status): string {
  return i18n.t(STATUS_KEYS[s]);
}

// Variante pour les lecteurs d'écran : les libellés affichés portent des
// symboles (✓, ★) que TalkBack et VoiceOver lisent tels quels. Consommée
// par StatusBadge et GoalCard, à côté de statusLabel.
const STATUS_SPOKEN_KEYS: Record<Status, string> = {
  ahead: 'statusSpoken.ahead',
  'on-track': 'statusSpoken.onTrack',
  late: 'statusSpoken.late',
  'not-started': 'statusSpoken.notStarted',
  reached: 'statusSpoken.reached',
  exceeded: 'statusSpoken.exceeded',
  failed: 'statusSpoken.failed',
};

export function statusSpokenLabel(s: Status): string {
  return i18n.t(STATUS_SPOKEN_KEYS[s]);
}
