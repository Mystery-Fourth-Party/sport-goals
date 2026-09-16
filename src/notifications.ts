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
// (parseReminderTime, ongoingGoalsWithoutTodayEntry,
// buildReminderContent) est testée (voir notifications.test.ts). Le reste
// n'a été vérifié que par lecture du code source du SDK, pas par exécution
// réelle sur appareil/simulateur — à tester sur un vrai build avant mise en prod.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { TFunction } from 'i18next';
import i18n from './i18n';
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
// `t` reçu en paramètre (pas d'import direct de l'instance i18next comme
// dans stats.ts/dateLabels.ts/confirm.ts) : cette fonction reste pure et
// testable avec un `t` stub, sans avoir à faire booter tout le runtime
// i18n dans notifications.test.ts (voir rescheduleDailyReminder plus bas
// pour la résolution du `t` réel, elle, orchestration).
export function buildReminderContent(
  pendingGoals: Goal[],
  today: string,
  streakAlertEnabled: boolean,
  t: TFunction,
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
        title: t('notif.streakDanger.title'),
        body: t('notif.streakDanger.body', { count: best.streak, title: best.title }),
      };
    }
  }
  return {
    title: t('notif.generic.title'),
    body: t('notif.generic.body'),
  };
}

// ─── Orchestration (appelle expo-notifications) ──────────────────────────

export interface RescheduleResult {
  ok: boolean;
  error?: string;
}

export interface RescheduleOptions {
  // Consultée juste avant d'annuler puis avant chaque programmation : rend
  // `true` si une exécution plus récente a été déclenchée depuis. Sans elle,
  // la garde `runId` de ReminderScheduler ne filtrait que l'affichage du
  // statut, et une exécution obsolète menait quand même son cycle
  // annulation + programmation jusqu'au bout, par-dessus une exécution plus
  // récente (L2-04).
  isStale?: () => boolean;
}

// Reprogramme le rappel quotidien à partir de l'état courant.
//
// Trigger DAILY, pas DATE : DAILY se répète nativement côté OS, sans que
// l'app ait besoin de tourner. Avec DATE, le rappel n'arrivait qu'une seule
// fois puis plus rien tant que l'app n'était pas rouverte — c'est-à-dire
// jamais, pour l'utilisateur que le rappel est justement censé ramener.
//
// Le contenu, lui, reste calculé à la programmation : le payload d'un
// trigger DAILY est figé, la variante « série en danger » ne peut donc pas
// se recalculer toute seule d'un jour sur l'autre. Elle est régénérée à
// chaque appel de cette fonction, c'est-à-dire à chaque fois que l'app
// tourne (voir ReminderScheduler). Un seul envoi porte les deux messages,
// générique et personnalisé — pas de seconde notification dédiée au streak,
// qui ferait arriver deux notifications au même horaire précisément le jour
// où une série est en jeu.
//
// Ordre des étapes : toute validation susceptible d'échouer passe AVANT
// l'annulation. Annuler d'abord, comme avant, détruisait un rappel valide
// déjà programmé quand la reprogrammation échouait ensuite — horaire mal
// formé, permission révoquée en arrière-plan (L1-06). Et l'annulation n'a
// jamais lieu sans reprogrammation immédiate derrière : avec un trigger
// DAILY, annuler sans réarmer supprime aussi tous les jours suivants
// (L2-01).
//
// Limite connue, hors scope de ce correctif : une notification programmée
// peut ne pas survivre à un redémarrage de l'appareil sur Android, le
// comportement variant selon les fabricants. C'est hors du contrôle
// d'expo-notifications ; l'app la reprogramme de toute façon à sa
// prochaine ouverture.
export async function rescheduleDailyReminder(
  goals: Goal[],
  today: string,
  reminderTime: string,
  streakAlertEnabled: boolean,
  options: RescheduleOptions = {},
): Promise<RescheduleResult> {
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
    return { ok: false, error: i18n.t('notifications.rescheduleInvalidTime') };
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    return { ok: false, error: i18n.t('notifications.rescheduleDenied') };
  }

  // Les objectifs sans entrée du jour déterminent le CONTENU (et les
  // horaires personnalisés à couvrir), plus la décision de programmer ou
  // non : un trigger DAILY tire tous les jours, et savoir qu'aujourd'hui
  // tout est loggé ne dit rien de demain. Quand plus rien n'est en attente,
  // on reprogramme donc quand même, avec le message générique.
  const pending = ongoingGoalsWithoutTodayEntry(goals, today);
  const groups = groupPendingGoalsByReminderTime(pending, reminderTime);
  const scheduled: { time: string; goalsInGroup: Goal[] }[] =
    groups.size > 0
      ? [...groups].map(([time, goalsInGroup]) => ({ time, goalsInGroup }))
      : [{ time: reminderTime, goalsInGroup: [] }];

  if (options.isStale?.()) return { ok: true };

  await cancelDailyReminder();

  for (const { time, goalsInGroup } of scheduled) {
    if (options.isStale?.()) return { ok: true };
    const parsedTime = parseReminderTime(time) ?? parsedDefault;
    const content = buildReminderContent(goalsInGroup, today, streakAlertEnabled, i18n.t);
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: parsedTime.hour,
        minute: parsedTime.minute,
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
      title: i18n.t('notif.goalReached.title'),
      body: i18n.t('notif.goalReached.body', { title: goalTitle }),
    },
    trigger: null,
  });
}
