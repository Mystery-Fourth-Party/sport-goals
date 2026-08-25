// Export/import local des données (objectifs + réglages), au format JSON —
// pas de backend pour ce projet (voir app/settings.tsx pour le partage/
// téléchargement et la sélection de fichier). Logique pure ici, testable
// sans module natif (même approche que notifications.ts) : construction et
// validation du payload uniquement, aucun accès fichier/AsyncStorage.
//
// Le format est documenté et figé pour être directement exploitable par un
// outil de traitement de données externe, pas seulement comme mécanisme de
// restauration interne — voir buildBackupPayload pour sa forme exacte.
import i18n from './i18n';
import { DEFAULT_SETTINGS, Settings } from './settingsStorage';
import { getGoalStats, GoalStats } from './stats';
import { Entry, Goal, Unit, UNITS } from './types';

export const SCHEMA_VERSION = 1;

export interface BackupGoal {
  id: string;
  title: string;
  unit: Unit;
  targetValue: number;
  createdAt: string;
  deadline: string;
  // Pratique pour un outil externe qui n'a pas UNIT_LABELS sous la main.
  unitLabel: string;
  entries: Entry[];
  // Reflètent Goal.reminderTime/reminderEnabled (voir types.ts) — absents du
  // JSON si jamais posés, même convention que recordedAt sur Entry ci-dessous.
  reminderTime?: string;
  reminderEnabled?: boolean;
  // Instantané dérivé (statut, progression, streak...), calculé au moment
  // de l'export via stats.ts — jamais réimplémenté ici. Purement informatif :
  // ignoré à l'import, voir parseBackupPayload.
  stats: GoalStats;
}

export interface BackupPayload {
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  goals: BackupGoal[];
  settings: Settings;
}

export function buildBackupPayload(
  goals: Goal[],
  settings: Settings,
  today: string,
): BackupPayload {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      unit: goal.unit,
      targetValue: goal.targetValue,
      createdAt: goal.createdAt,
      deadline: goal.deadline,
      unitLabel: i18n.t(`unit.${goal.unit}`),
      entries: goal.entries.map((e) => ({
        date: e.date,
        value: e.value,
        ...(e.recordedAt !== undefined ? { recordedAt: e.recordedAt } : {}),
      })),
      ...(goal.reminderTime !== undefined ? { reminderTime: goal.reminderTime } : {}),
      ...(goal.reminderEnabled !== undefined ? { reminderEnabled: goal.reminderEnabled } : {}),
      stats: getGoalStats(goal, today),
    })),
    settings,
  };
}

// ─── Import : validation stricte des goals, tolérante pour settings ─────

export type ParseBackupResult =
  { ok: true; goals: Goal[]; settings?: Settings } | { ok: false; error: string };

const VALID_UNITS = new Set<string>(UNITS);

interface RawEntry {
  date: string;
  value: number;
  recordedAt?: string;
}

function isValidEntry(value: unknown): value is RawEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  if (typeof e.date !== 'string') return false;
  if (typeof e.value !== 'number') return false;
  if (e.recordedAt !== undefined && typeof e.recordedAt !== 'string') return false;
  return true;
}

interface RawGoal {
  id: string;
  title: string;
  unit: Unit;
  targetValue: number;
  createdAt: string;
  deadline: string;
  entries: RawEntry[];
  reminderTime?: string;
  reminderEnabled?: boolean;
}

function isValidGoal(value: unknown): value is RawGoal {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  if (typeof g.id !== 'string') return false;
  if (typeof g.title !== 'string') return false;
  if (typeof g.targetValue !== 'number') return false;
  if (typeof g.unit !== 'string' || !VALID_UNITS.has(g.unit)) return false;
  if (typeof g.createdAt !== 'string') return false;
  if (typeof g.deadline !== 'string') return false;
  if (!Array.isArray(g.entries) || !g.entries.every(isValidEntry)) return false;
  // Validation légère (type seulement) : le format "HH:mm" de reminderTime
  // n'est pas vérifié ici (ça dupliquerait parseReminderTime) — un horaire
  // mal formé reste accepté à l'import, le fallback sur l'horaire global se
  // fait au moment de l'usage (voir groupPendingGoalsByReminderTime).
  if (g.reminderTime !== undefined && typeof g.reminderTime !== 'string') return false;
  if (g.reminderEnabled !== undefined && typeof g.reminderEnabled !== 'boolean') return false;
  return true;
}

export function parseBackupPayload(raw: string): ParseBackupResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Fichier JSON invalide.' };
  }

  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Format de fichier invalide.' };
  }
  const payload = data as Record<string, unknown>;

  if (payload.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Version de fichier non prise en charge (${JSON.stringify(payload.schemaVersion)}).`,
    };
  }

  if (!Array.isArray(payload.goals) || !payload.goals.every(isValidGoal)) {
    return { ok: false, error: 'Liste des objectifs manquante ou mal formée dans le fichier.' };
  }

  // stats/unitLabel (s'ils sont présents dans le fichier) ne sont jamais
  // copiés : seuls les champs de Goal sont repris explicitement ci-dessous.
  const goals: Goal[] = payload.goals.map((g) => ({
    id: g.id,
    title: g.title,
    targetValue: g.targetValue,
    unit: g.unit,
    createdAt: g.createdAt,
    deadline: g.deadline,
    entries: g.entries.map((e) => ({
      date: e.date,
      value: e.value,
      ...(e.recordedAt !== undefined ? { recordedAt: e.recordedAt } : {}),
    })),
    ...(g.reminderTime !== undefined ? { reminderTime: g.reminderTime } : {}),
    ...(g.reminderEnabled !== undefined ? { reminderEnabled: g.reminderEnabled } : {}),
  }));

  if (payload.settings === undefined) {
    return { ok: true, goals };
  }
  if (typeof payload.settings !== 'object' || payload.settings === null) {
    return { ok: false, error: 'Réglages mal formés dans le fichier.' };
  }
  // Fusionné avec DEFAULT_SETTINGS comme le fait déjà loadSettings, pour
  // tolérer un fichier plus ancien avec des clés manquantes.
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(payload.settings as Partial<Settings>) };

  return { ok: true, goals, settings };
}
