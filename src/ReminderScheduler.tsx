import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGoals } from './goals-context';
import { cancelDailyReminder, rescheduleDailyReminder } from './notifications';
import { useReminderStatus } from './reminder-status';
import { useSettings } from './settings-context';
import { todayStr } from './stats';

// Composant invisible monté une fois dans app/_layout.tsx (à l'intérieur de
// SettingsProvider, GoalsProvider et ReminderStatusProvider) : maintient le
// rappel quotidien programmé en fonction de l'état courant. Se redéclenche à
// chaque changement pertinent — notamment `goals`, pour recalculer "faut-il
// encore rappeler aujourd'hui ?" dès qu'une progression est ajoutée (la
// fonction annule puis reprogramme, ce qui pousse naturellement la prochaine
// notification à demain si plus aucun objectif en cours n'attend une entrée
// aujourd'hui).
//
// Le résultat de chaque reprogrammation (succès/échec) est posé dans
// ReminderStatusProvider plutôt qu'ignoré : une reprogrammation peut échouer
// bien après le lancement de l'app (permission révoquée entre-temps,
// canAskAgain passé à false...), pas seulement au moment où l'utilisateur
// édite le réglage depuis SettingsScreen.
export default function ReminderScheduler() {
  const { goals, loaded: goalsLoaded } = useGoals();
  const { settings, loaded: settingsLoaded } = useSettings();
  const { setError } = useReminderStatus();
  // Redéclenche la reprogrammation quand la langue change : à la fois pour
  // que reminderStatusError (affiché dans NotificationsSection) ne reste
  // pas figé dans l'ancienne langue si une erreur est déjà affichée, et
  // pour que le contenu de la notification déjà programmée (titre/corps,
  // voir buildReminderContent) soit regénéré dans la nouvelle langue —
  // sinon elle resterait programmée dans l'ancienne jusqu'au prochain
  // changement de `goals`/`settings`.
  const { i18n } = useTranslation();
  // Incrémenté à chaque exécution de l'effet, capturé localement avant
  // l'appel async : l'effet peut se redéclencher plusieurs fois avant qu'une
  // promesse précédente ne se résolve (ex. sur web, la saisie libre de
  // l'heure appelle updateSettings à chaque frappe, donc l'effet tourne à
  // chaque caractère avec des valeurs intermédiaires souvent invalides). Sans
  // cette garde, une réponse obsolète pourrait arriver après une réponse
  // plus récente et écraser le statut affiché — on ne veut appliquer que le
  // résultat de la DERNIÈRE exécution déclenchée, jamais une plus ancienne,
  // quel que soit l'ordre de résolution des promesses.
  const runId = useRef(0);

  useEffect(() => {
    if (!goalsLoaded || !settingsLoaded) return;
    const thisRun = ++runId.current;

    if (!settings.dailyReminder) {
      // Échec d'annulation laissé silencieux côté UI, décision de la PR du
      // chantier « rappel quotidien » : seul rescheduleDailyReminder remonte
      // ses rejets dans ReminderStatusProvider. console.error pour la parité
      // avec storage.ts/settingsStorage.ts, qui tracent leurs échecs.
      cancelDailyReminder().catch((error) => {
        console.error('cancelDailyReminder: échec de l’annulation du rappel.', error);
      });
      setError(undefined);
      return;
    }

    rescheduleDailyReminder(goals, todayStr(), settings.reminderTime, settings.streakAlert, {
      // La garde ne sert plus seulement à filtrer l'affichage du statut :
      // elle est consultée à l'intérieur, avant l'annulation et avant chaque
      // programmation, pour qu'une exécution obsolète n'aille pas défaire ou
      // doubler ce qu'une exécution plus récente vient de poser (L2-04).
      isStale: () => runId.current !== thisRun,
    })
      .then((result) => {
        if (runId.current !== thisRun) return; // réponse obsolète, ignorée.
        setError(result.ok ? undefined : result.error);
      })
      // Rejet imprévu d'expo-notifications : notifications.ts ne rattrape
      // rien en interne. Remonté dans le statut comme un échec de
      // reprogrammation ordinaire — c'est le seul des trois appels de
      // notification à avoir une UI pour le dire (câblée depuis la PR #10).
      .catch((error) => {
        console.error('rescheduleDailyReminder: rejet inattendu.', error);
        if (runId.current !== thisRun) return;
        // i18n.t plutôt que le `t` d'un Hook : c'est déjà ainsi que
        // notifications.ts produit rescheduleInvalidTime/rescheduleDenied,
        // et ça évite d'ajouter une dépendance à l'effet.
        setError(i18n.t('notifications.rescheduleFailed'));
      });
  }, [
    goals,
    settings.dailyReminder,
    settings.reminderTime,
    settings.streakAlert,
    goalsLoaded,
    settingsLoaded,
    setError,
    // `i18n` est une référence stable (react-i18next) : la lister ne
    // provoque aucune exécution supplémentaire, elle est requise depuis que
    // l'effet appelle i18n.t pour le message d'échec. `i18n.language` reste
    // listée explicitement, c'est elle qui porte l'intention de rejouer la
    // reprogrammation à chaque changement de langue.
    i18n,
    i18n.language,
  ]);

  return null;
}
