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
  // Pratique pour un outil externe qui n'a pas accès aux traductions
  // unit.* (voir src/i18n/locales/*.json) sous la main.
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

// L'instantané de stats n'est jamais réimporté (voir parseBackupPayload),
// mais le fichier est destiné à être ouvert et exploité tel quel — une somme
// de décimales accumulée en flottant s'y écrivait brute
// ("actual": 12.399999999999999 pour 5.3 + 4.1 + 3, constaté sur un export
// réel). Arrondi ici seulement, pas dans stats.ts : le calcul interne doit
// rester exact. 4 décimales, assez pour rester fidèle aux ratios (progress,
// expectedProgress) sans laisser d'artefact binaire.
function roundStat(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function roundGoalStats(stats: GoalStats): GoalStats {
  return {
    ...stats,
    actual: roundStat(stats.actual),
    progress: roundStat(stats.progress),
    expectedProgress: roundStat(stats.expectedProgress),
    dailyRequired: roundStat(stats.dailyRequired),
    dailyAvg: roundStat(stats.dailyAvg),
  };
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
      stats: roundGoalStats(getGoalStats(goal, today)),
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

const DATE_STR_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Vrai si la chaîne est exactement ce que dateStr() (stats.ts) produit :
// "YYYY-MM-DD" avec un jour qui existe. Le motif seul laisse passer
// "2026-02-30", et new Date() seul accepte d'autres formats et fait
// glisser les jours impossibles au mois suivant — d'où l'aller-retour :
// la date reconstruite doit redonner les mêmes composantes. Date.UTC
// plutôt que le constructeur local, pour que le résultat ne dépende pas
// du fuseau de la machine.
function isCanonicalDateStr(s: string): boolean {
  const m = DATE_STR_PATTERN.exec(s);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// Partie heure d'une date ISO 8601, optionnelle : THH:mm, secondes et
// fraction facultatives, puis une zone obligatoire, Z ou ±HH:mm.
const ISO_TIME_SUFFIX_PATTERN = /^(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

// Vrai pour "YYYY-MM-DD" dont le jour existe, suivi en option d'une heure
// zonée. C'est la forme que toISOString() écrit dans createdAt et deadline
// (GoalForm.tsx, app/goal/[id]/edit.tsx), la seule que l'app ait jamais
// écrite dans ces champs. Le jour passe par l'aller-retour de
// isCanonicalDateStr : le motif seul n'écarte pas "2026-02-30". La zone est
// exigée dès qu'une heure est présente : sans elle, la chaîne est lue en
// heure locale et la comparaison avec createdAt dépendrait du fuseau de la
// machine. La date seule reste acceptée, elle est lue en UTC.
function isIsoDateTimeStr(s: string): boolean {
  return isCanonicalDateStr(s.slice(0, 10)) && ISO_TIME_SUFFIX_PATTERN.test(s.slice(10));
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

// Cohérence des objectifs, après isValidGoal. Les deux passes répondent à
// deux questions distinctes : isValidGoal à « est-ce la bonne forme »,
// celle-ci à « est-ce que ça a du sens ». Séparées parce qu'isValidGoal est
// un type-guard booléen, consommé par .every() : il ne peut pas dire
// laquelle de ses vérifications a échoué, alors que chaque règle ci-dessous
// porte son propre message — un utilisateur qui a édité son fichier doit
// savoir quoi y corriger.
//
// Toutes rejettent le fichier entier plutôt que de réparer : aucune valeur
// de repli ne remplacerait une donnée de l'utilisateur sans l'inventer, et
// l'import est destructif (replaceAllGoals efface l'existant, voir
// goals-context.tsx). Les réglages suivent la règle inverse, voir
// sanitizeSettings plus bas.
//
// Renvoie le message de la première règle violée, ou null si tout passe.
function findGoalInconsistency(goals: RawGoal[]): string | null {
  const seenIds = new Set<string>();

  for (const g of goals) {
    // L1-09 — updateGoal et deleteGoal opèrent par .map/.filter sur l'id :
    // deux objectifs au même id sont modifiés ou supprimés ensemble, sans
    // que rien ne le signale à l'écran.
    if (seenIds.has(g.id)) return i18n.t('backup.duplicateGoalIds');
    seenIds.add(g.id);

    // L1-12 — Number.isFinite et pas seulement > 0 : Infinity ne s'écrit
    // pas en JSON, mais JSON.parse le rend sur un exposant hors domaine
    // (1e400), et typeof Infinity vaut 'number'. NaN, lui, ne peut pas
    // arriver — JSON.parse refuse le littéral.
    if (!Number.isFinite(g.targetValue) || g.targetValue <= 0) {
      return i18n.t('backup.invalidTargetValue');
    }

    // L1-05 — isValidGoal ne vérifie que le type de ces deux champs, donc
    // n'importe quelle chaîne passait. Le contrôle NaN seul laissait encore
    // passer tout ce que le moteur sait analyser ("1", "Oct 1 2026", une
    // année étendue, "2026-02-30" qui glisse au 2 mars) : la forme ISO est
    // exigée d'abord, voir isIsoDateTimeStr. Le contrôle NaN reste, pour
    // une heure hors plage (25:00) que le motif ne voit pas.
    const createdAt = new Date(g.createdAt).getTime();
    const deadline = new Date(g.deadline).getTime();
    if (
      !isIsoDateTimeStr(g.createdAt) ||
      !isIsoDateTimeStr(g.deadline) ||
      Number.isNaN(createdAt) ||
      Number.isNaN(deadline)
    ) {
      return i18n.t('backup.invalidGoalDates');
    }
    // Comparaison sur les instants et non sur les jours locaux : la
    // validation ne dépend ainsi pas du fuseau de la machine, un fichier
    // accepté ici l'étant partout. Reste le cas de deux instants tombant
    // le même jour local à quelques heures d'écart, que le garde-fou de
    // durée nulle de stats.ts (expectedProgress à 1) couvre déjà.
    if (deadline <= createdAt) return i18n.t('backup.deadlineNotAfterCreatedAt');

    const seenDates = new Set<string>();
    for (const e of g.entries) {
      // Zéro reste valide et signifiant : « pas d'entrée ce jour-là » doit
      // rester distinct de « une entrée à 0 » (voir deleteEntry et
      // ongoingGoalsWithoutTodayEntry).
      if (!Number.isFinite(e.value) || e.value < 0) {
        return i18n.t('backup.invalidEntryValue');
      }

      // R1 — isValidEntry ne vérifie que le type. Le tri plus bas compare
      // des chaînes et calcStreak/getGoalStats lisent la date comme dateStr()
      // la produit : toute autre forme casse l'ordre sans rien signaler.
      // Interpolé pour la même raison que le doublon ci-dessous.
      if (!isCanonicalDateStr(e.date)) {
        return i18n.t('backup.invalidEntryDate', { title: g.title, date: e.date });
      }

      // L4-02 — la même donnée était lue de trois façons incompatibles en
      // aval : sommée par getGoalStats, dernière-gagne par calcStreak
      // (Map par date), première-trouvée par addProgress (findIndex).
      // Rejet plutôt que fusion : l'app ne sait pas produire ce cas —
      // addProgress fusionne dans l'entrée du jour, updateEntry remplace
      // en place, deleteEntry supprime toutes les occurrences — donc un
      // doublon signale un fichier abîmé, pas deux séances. Seul message
      // interpolé du lot : c'est la seule règle où l'utilisateur ne peut
      // rien corriger sans savoir où regarder.
      if (seenDates.has(e.date)) {
        return i18n.t('backup.duplicateEntryDates', { title: g.title, date: e.date });
      }
      seenDates.add(e.date);
    }
  }

  return null;
}

// L1-04 — payload.settings n'était vérifié que comme objet, puis fusionné
// tel quel : un dailyReminder à "oui" ou une langue à "xx" filaient jusqu'à
// l'usage. Règle inverse de celle des objectifs, et pour une raison :
// chaque réglage a déjà une valeur par défaut documentée dans
// DEFAULT_SETTINGS, donc le repli n'invente rien. Rejeter tout le fichier
// pour une préférence mal typée ferait perdre les objectifs avec, qui sont
// la partie qui a de la valeur.
function sanitizeSettings(raw: Record<string, unknown>): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };

  if (typeof raw.dailyReminder === 'boolean') settings.dailyReminder = raw.dailyReminder;
  // Type vérifié, format non — même arbitrage que pour le reminderTime
  // d'un objectif (voir isValidGoal) : le repli sur l'horaire global se
  // fait à l'usage, et vérifier ici dupliquerait parseReminderTime.
  if (typeof raw.reminderTime === 'string') settings.reminderTime = raw.reminderTime;
  if (typeof raw.goalReachedNotifs === 'boolean') {
    settings.goalReachedNotifs = raw.goalReachedNotifs;
  }
  if (typeof raw.almostThereNotifs === 'boolean') {
    settings.almostThereNotifs = raw.almostThereNotifs;
  }
  if (typeof raw.streakAlert === 'boolean') settings.streakAlert = raw.streakAlert;
  // Laissé absent si la valeur n'est pas supportée : absent veut dire
  // « suit la langue de l'appareil » (voir settingsStorage.ts), ce qui est
  // le défaut documenté de ce champ — il n'y en a pas d'autre.
  if (raw.language === 'fr' || raw.language === 'en') settings.language = raw.language;

  return settings;
}

export function parseBackupPayload(raw: string): ParseBackupResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: i18n.t('backup.invalidJson') };
  }

  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: i18n.t('backup.invalidFileFormat') };
  }
  const payload = data as Record<string, unknown>;

  if (payload.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: i18n.t('backup.unsupportedVersion', {
        version: JSON.stringify(payload.schemaVersion),
      }),
    };
  }

  if (!Array.isArray(payload.goals) || !payload.goals.every(isValidGoal)) {
    return { ok: false, error: i18n.t('backup.missingGoals') };
  }

  // Seconde passe : la forme est bonne, reste à savoir si le contenu tient
  // debout. Voir findGoalInconsistency pour la raison de la séparation.
  const inconsistency = findGoalInconsistency(payload.goals);
  if (inconsistency !== null) {
    return { ok: false, error: inconsistency };
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
    // Trié par date (L2-07) : GoalHistoryList fait
    // [...entries].reverse().slice(0, 12) et RecentSessionsCard .slice(-7),
    // deux lectures qui supposent l'ordre chronologique sans que rien ne le
    // garantisse pour un fichier importé. Comparaison de chaînes plutôt que
    // de dates analysées : le format YYYY-MM-DD se trie lexicographiquement
    // dans l'ordre chronologique, sans parsing ni dépendance au fuseau.
    // Pas de troisième cas dans le comparateur : deux entrées à la même
    // date ont déjà fait rejeter le fichier (voir findGoalInconsistency),
    // donc il ne rencontre jamais d'égalité. Le laisser aurait été une
    // branche morte, invérifiable par un test.
    entries: [...g.entries]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((e) => ({
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
    return { ok: false, error: i18n.t('backup.invalidSettings') };
  }

  const settings = sanitizeSettings(payload.settings as Record<string, unknown>);

  return { ok: true, goals, settings };
}
