import { useEffect, useRef } from 'react';
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
      cancelDailyReminder();
      setError(undefined);
      return;
    }

    rescheduleDailyReminder(goals, todayStr(), settings.reminderTime, settings.streakAlert).then(
      (result) => {
        if (runId.current !== thisRun) return; // réponse obsolète, ignorée.
        setError(result.ok ? undefined : result.error);
      },
    );
  }, [
    goals,
    settings.dailyReminder,
    settings.reminderTime,
    settings.streakAlert,
    goalsLoaded,
    settingsLoaded,
    setError,
  ]);

  return null;
}
