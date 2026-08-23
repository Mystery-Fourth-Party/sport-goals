import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  ensureNotificationPermission,
  notificationsSupported,
  parseReminderTime,
} from '../../notifications';
import { useReminderStatus } from '../../reminder-status';
import { useSettings } from '../../settings-context';
import { TimeField, Toggle } from '../ui';
import { settingsStyles as s } from './styles';

// 4 toggles + le time picker multi-plateforme (voir src/components/ui/
// TimeField) + les statuts d'erreur qui leur sont propres (notifError/
// reminderTimeError/le statut de reprogrammation posé par
// ReminderScheduler). Découpé hors de app/settings.tsx (474 lignes,
// UI+logique+styles mélangés) sans changement de comportement — voir aussi
// DataSection pour la carte "Données".
export default function NotificationsSection() {
  const { settings, updateSettings } = useSettings();
  const { error: reminderStatusError } = useReminderStatus();
  // Message affiché si la demande de permission échoue (plateforme non
  // supportée ou refus de l'utilisateur) — voir requestPermissionOrExplain.
  const [notifError, setNotifError] = useState<string | undefined>();

  // Le picker natif (iOS/Android) ne peut pas produire de valeur invalide ;
  // seul le repli texte libre du web (voir TimeField) en a besoin.
  const reminderTimeError =
    Platform.OS === 'web' && settings.dailyReminder && !parseReminderTime(settings.reminderTime)
      ? 'Format invalide — utilise HH:mm (ex : 20:00).'
      : undefined;

  // La permission est demandée ici, au moment où l'utilisateur active un
  // toggle qui en a besoin — pas au lancement de l'app, ni pour les toggles
  // qui ne déclenchent rien de réel (almostThereNotifs ne pilote qu'une
  // bannière in-app, voir app/goal/[id].tsx). Ce mécanisme couvre le refus
  // AVANT que le toggle ne passe à "on" ; reminderStatusError (ci-dessus)
  // couvre ce qui se dérègle APRÈS coup lors des reprogrammations
  // automatiques (voir ReminderScheduler) — les deux coexistent.
  async function requestPermissionOrExplain(): Promise<boolean> {
    if (!notificationsSupported()) {
      setNotifError('Notifications indisponibles sur cette plateforme (web).');
      return false;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      setNotifError("Notifications refusées — active-les dans les réglages de l'appareil.");
      return false;
    }
    setNotifError(undefined);
    return true;
  }

  async function handleDailyReminderToggle(v: boolean) {
    if (v && !(await requestPermissionOrExplain())) return;
    updateSettings({ dailyReminder: v });
  }

  async function handleGoalReachedToggle(v: boolean) {
    if (v && !(await requestPermissionOrExplain())) return;
    updateSettings({ goalReachedNotifs: v });
  }

  return (
    <>
      <Text style={s.sectionLabel}>Notifications</Text>
      {notifError && <Text style={s.errorText}>{notifError}</Text>}
      <View style={s.card}>
        <View style={[s.row, s.rowBorder]}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>Rappel quotidien</Text>
            <Text style={s.rowSubtitle}>Pour entrer ta progression chaque jour</Text>
          </View>
          <Toggle
            value={settings.dailyReminder}
            onChange={handleDailyReminderToggle}
            accessibilityLabel="Rappel quotidien"
          />
        </View>

        {settings.dailyReminder && (
          <View style={[s.row, s.rowBorder, styles.rowWrap]}>
            <View style={styles.timeRow}>
              <Text style={s.rowTitle}>Heure du rappel</Text>
              <TimeField
                value={settings.reminderTime}
                onChange={(v) => updateSettings({ reminderTime: v })}
              />
            </View>
            {reminderTimeError && <Text style={s.errorText}>{reminderTimeError}</Text>}
            {/* Distinct de reminderTimeError : couvre l'échec d'une
                reprogrammation automatique après coup (permission révoquée
                entre-temps...), posé par ReminderScheduler via
                useReminderStatus — pas une validation de saisie. */}
            {reminderStatusError && <Text style={s.errorText}>{reminderStatusError}</Text>}
          </View>
        )}

        <View style={[s.row, s.rowBorder]}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>Objectif atteint 🏆</Text>
            <Text style={s.rowSubtitle}>Célébration quand un objectif est complété</Text>
          </View>
          <Toggle
            value={settings.goalReachedNotifs}
            onChange={handleGoalReachedToggle}
            accessibilityLabel="Objectif atteint 🏆"
          />
        </View>

        <View style={[s.row, s.rowBorder]}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>Objectif bientôt atteint 🎯</Text>
            <Text style={s.rowSubtitle}>Quand il ne reste que quelques % pour finir</Text>
          </View>
          <Toggle
            value={settings.almostThereNotifs}
            onChange={(v) => updateSettings({ almostThereNotifs: v })}
            accessibilityLabel="Objectif bientôt atteint 🎯"
          />
        </View>

        <View style={s.row}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>Streak en danger 🔥</Text>
            <Text style={s.rowSubtitle}>Si tu n&apos;as pas encore entré ta progression</Text>
          </View>
          <Toggle
            value={settings.streakAlert}
            onChange={(v) => updateSettings({ streakAlert: v })}
            accessibilityLabel="Streak en danger 🔥"
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
