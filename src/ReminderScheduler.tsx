import { useEffect } from 'react';
import { useGoals } from './goals-context';
import { cancelDailyReminder, rescheduleDailyReminder } from './notifications';
import { useSettings } from './settings-context';
import { todayStr } from './stats';

// Composant invisible monté une fois dans app/_layout.tsx (à l'intérieur de
// SettingsProvider et GoalsProvider) : maintient le rappel quotidien
// programmé en fonction de l'état courant. Se redéclenche à chaque
// changement pertinent — notamment `goals`, pour recalculer "faut-il encore
// rappeler aujourd'hui ?" dès qu'une progression est ajoutée (la fonction
// annule puis reprogramme, ce qui pousse naturellement la prochaine
// notification à demain si plus aucun objectif en cours n'attend une
// entrée aujourd'hui).
//
// Les erreurs (heure invalide, permission refusée) sont surfacées à
// l'utilisateur depuis SettingsScreen au moment où il édite le réglage,
// pas ici : ce composant ne fait que maintenir l'état en arrière-plan.
export default function ReminderScheduler() {
  const { goals, loaded: goalsLoaded } = useGoals();
  const { settings, loaded: settingsLoaded } = useSettings();

  useEffect(() => {
    if (!goalsLoaded || !settingsLoaded) return;
    if (!settings.dailyReminder) {
      cancelDailyReminder();
      return;
    }
    rescheduleDailyReminder(goals, todayStr(), settings.reminderTime, settings.streakAlert);
  }, [
    goals,
    settings.dailyReminder,
    settings.reminderTime,
    settings.streakAlert,
    goalsLoaded,
    settingsLoaded,
  ]);

  return null;
}
