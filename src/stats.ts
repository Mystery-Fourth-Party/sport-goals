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
import { Entry, Goal } from './types';

export type Status = 'ahead' | 'on-track' | 'late' | 'completed' | 'not-started';

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
}

// ─── Dates ──────────────────────────────────────────────────────────────

// Ne garde que la partie "YYYY-MM-DD" d'une chaîne ISO complète
// (createdAt/deadline) — c'est le format attendu par parseDate/dateStr.
function toDayStr(iso: string): string {
  return iso.slice(0, 10);
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
  const expectedProgress = totalDays > 0 ? elapsedDays / totalDays : 0;
  const dailyRequired = remainingDays > 0 ? (goal.targetValue - actual) / remainingDays : 0;
  const dailyAvg = totalDays > 0 ? goal.targetValue / totalDays : 0;

  let status: Status;
  if (progress >= 1) {
    status = 'completed';
  } else if (elapsedDays === 0 && actual === 0) {
    status = 'not-started';
  } else {
    const diff = progress - expectedProgress;
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

  const withStats = goals.map((g) => ({ goal: g, stats: getGoalStats(g, today) }));
  const mostAdvanced = [...withStats].sort((a, b) => b.stats.progress - a.stats.progress)[0];
  const mostBehind = [...withStats].sort(
    (a, b) =>
      a.stats.progress - a.stats.expectedProgress - (b.stats.progress - b.stats.expectedProgress),
  )[0];

  return { weekDates, sessionsPerDay, activeDays, totalSessions, mostAdvanced, mostBehind };
}

// ─── Formatage / libellés statut ───────────────────────────────────────

export function fmt(value: number, unit: Goal['unit']): string {
  if (unit === 'km') return value.toFixed(1);
  return Math.round(value).toString();
}

export function statusLabel(s: Status): string {
  return {
    ahead: 'En avance',
    'on-track': 'Dans les temps',
    late: 'En retard',
    completed: 'Terminé ✓',
    'not-started': 'Pas commencé',
  }[s];
}
