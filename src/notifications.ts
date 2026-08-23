// Notifications locales : rappel quotidien (avec variante "streak en
// danger") + notification "objectif atteint". Pas de backend disponible :
// tout est programmé/annulé/reprogrammé depuis l'appareil (voir
// rescheduleDailyReminder plus bas).
//
// Limite connue, vérifiée dans le code source du package (pas seulement
// supposée depuis la doc) : sur web, `NotificationScheduler` n'expose pas
// `scheduleNotificationAsync` (node_modules/expo-notifications/build/
// NotificationScheduler.js, résolu à la place de la version .native sur
// web, est un stub vide) — l'appeler y lève une UnavailabilityError. Donc
// rien de ce qui programme/déclenche une notification n'est vérifiable
// depuis l'aperçu navigateur de ce projet ; seule la logique pure ci-dessous
// (parseReminderTime, computeNextReminderDate, ongoingGoalsWithoutTodayEntry,
// buildReminderContent) est testée (voir notifications.test.ts). Le reste
// n'a été vérifié que par lecture du code source du SDK, pas par exécution
// réelle sur appareil/simulateur — à tester sur un vrai build avant mise en prod.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { calcStreak, dateStr, getGoalStats, parseDate } from './stats';
import { Goal } from './types';

const CHANNEL_ID = 'reminders';

export function notificationsSupported(): boolean {
  return Platform.OS !== 'web';
}

let handlerConfigured = false;
function configureHandlerOnce() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Requis sur Android 8+ (API 26+) : sans channel, aucune notification ne
  // s'affiche sur ces versions. setNotificationChannelAsync crée le channel
  // s'il n'existe pas encore (idempotent, donc sûr à rappeler à chaque fois).
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rappels et objectifs',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  configureHandlerOnce();
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (granted) await setupAndroidChannel();
  return granted;
}

// ─── Logique pure (testable sans toucher expo-notifications) ────────────

export function parseReminderTime(time: string): { hour: number; minute: number } | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

// Prochaine occurrence de hour:minute strictement après `now` — aujourd'hui
// si pas encore passée, sinon demain.
export function computeNextReminderDate(now: Date, hour: number, minute: number): Date {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

// Objectifs "en cours" (ni terminés), n'ayant reçu aucune entrée aujourd'hui,
// et pas explicitement exclus du rappel (reminderEnabled === false — absent
// ou true reste inclus, voir types.ts) — ce sont les seuls concernés par le
// rappel quotidien.
export function ongoingGoalsWithoutTodayEntry(goals: Goal[], today: string): Goal[] {
  return goals.filter((g) => {
    if (g.reminderEnabled === false) return false;
    if (getGoalStats(g, today).status === 'completed') return false;
    return !g.entries.some((e) => e.date === today && e.value > 0);
  });
}

// Regroupe des objectifs déjà filtrés (voir ongoingGoalsWithoutTodayEntry —
// cette fonction n'a pas besoin de connaître reminderEnabled, seulement ce
// qu'on lui donne) par horaire effectif : goal.reminderTime s'il est posé et
// valide, sinon defaultTime. Retombe sur defaultTime aussi bien pour un
// horaire absent que pour un horaire corrompu — un import peut laisser
// passer un reminderTime mal formé (voir backup.ts, isValidGoal ne vérifie
// que le type) : c'est ici, à l'usage, que le fallback se produit, pas à
// l'import.
export function groupPendingGoalsByReminderTime(
  pendingGoals: Goal[],
  defaultTime: string,
): Map<string, Goal[]> {
  const groups = new Map<string, Goal[]>();
  for (const g of pendingGoals) {
    const time = g.reminderTime && parseReminderTime(g.reminderTime) ? g.reminderTime : defaultTime;
    const group = groups.get(time);
    if (group) {
      group.push(g);
    } else {
      groups.set(time, [g]);
    }
  }
  return groups;
}

export interface ReminderContent {
  title: string;
  body: string;
}

function yesterdayStr(today: string): string {
  const d = parseDate(today);
  d.setDate(d.getDate() - 1);
  return dateStr(d);
}

// Message générique, sauf si streakAlertEnabled et qu'au moins un objectif
// concerné a un streak en cours — calculé à la veille : aujourd'hui n'a
// justement pas encore d'entrée (sinon on ne serait pas ici), donc
// calcStreak(..., today) vaudrait toujours 0. On veut le streak "qui va se
// casser si rien n'est ajouté aujourd'hui", donc celui qui s'arrête hier.
export function buildReminderContent(
  pendingGoals: Goal[],
  today: string,
  streakAlertEnabled: boolean,
): ReminderContent {
  if (streakAlertEnabled) {
    const yesterday = yesterdayStr(today);
    let best: { title: string; streak: number } | null = null;
    for (const g of pendingGoals) {
      const streak = calcStreak(g.entries, yesterday);
      if (streak > 0 && (!best || streak > best.streak)) {
        best = { title: g.title, streak };
      }
    }
    if (best) {
      return {
        title: 'Ton streak est en danger 🔥',
        body: `Ton streak de ${best.streak} jour(s) sur "${best.title}" va se casser si tu n'ajoutes rien aujourd'hui !`,
      };
    }
  }
  return {
    title: 'Objectif sportif 💪',
    body: "Tu n'as pas encore ajouté ta progression aujourd'hui.",
  };
}

// ─── Orchestration (appelle expo-notifications) ──────────────────────────

export interface RescheduleResult {
  ok: boolean;
  error?: string;
}

export async function rescheduleDailyReminder(
  goals: Goal[],
  today: string,
  reminderTime: string,
  streakAlertEnabled: boolean,
): Promise<RescheduleResult> {
  await cancelDailyReminder();

  const pending = ongoingGoalsWithoutTodayEntry(goals, today);
  if (pending.length === 0) {
    // Rien à rappeler : soit déjà loggé aujourd'hui sur tous les objectifs
    // en cours, soit aucun objectif en cours du tout.
    return { ok: true };
  }

  if (!notificationsSupported()) {
    return { ok: true }; // Pas une erreur utilisateur : juste indisponible sur cette plateforme.
  }

  // La validation de format et la demande de permission ne portent que sur
  // l'horaire GLOBAL, comme avant : un override par-objectif mal formé
  // retombe silencieusement sur ce même horaire (voir
  // groupPendingGoalsByReminderTime) plutôt que de faire échouer toute la
  // reprogrammation.
  const parsedDefault = parseReminderTime(reminderTime);
  if (!parsedDefault) {
    return { ok: false, error: 'Heure invalide — utilise le format HH:mm (ex : 20:00).' };
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    return { ok: false, error: 'Notifications non autorisées.' };
  }

  const now = new Date();
  // Un cancelDailyReminder() unique en entrée suffit (cancelAll reste
  // correct, pas besoin de suivre des identifiants individuels) ; ensuite,
  // une notification par horaire distinct plutôt qu'une seule pour tous les
  // objectifs en attente — buildReminderContent (inchangée) appelée par
  // groupe, message mécaniquement plus pertinent puisqu'il ne porte que sur
  // les objectifs de ce groupe.
  const groups = groupPendingGoalsByReminderTime(pending, reminderTime);
  for (const [time, goalsInGroup] of groups) {
    const parsedTime = parseReminderTime(time) ?? parsedDefault;
    const target = computeNextReminderDate(now, parsedTime.hour, parsedTime.minute);
    const content = buildReminderContent(goalsInGroup, today, streakAlertEnabled);
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
        channelId: CHANNEL_ID,
      },
    });
  }
  return { ok: true };
}

export async function cancelDailyReminder(): Promise<void> {
  if (!notificationsSupported()) return;
  // Un seul type de notification programmée (non immédiate) existe dans
  // l'app : le rappel quotidien — "objectif atteint" est envoyée
  // immédiatement (trigger: null), donc jamais dans la file programmée.
  // cancelAll est donc sûr ici et évite d'avoir à suivre un identifiant à
  // travers les redémarrages de l'app.
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendGoalReachedNotification(goalTitle: string): Promise<void> {
  if (!notificationsSupported()) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Objectif atteint 🏆',
      body: `"${goalTitle}" est terminé — bravo !`,
    },
    trigger: null,
  });
}
