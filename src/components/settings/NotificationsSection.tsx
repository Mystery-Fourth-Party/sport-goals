import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  ensureNotificationPermission,
  notificationsSupported,
  parseReminderTime,
} from '../../notifications';
import { useReminderStatus } from '../../reminder-status';
import { useSettings } from '../../settings-context';
import { colors, fontFamily, white } from '../../theme';
import { Toggle } from '../ui';
import { settingsStyles as s } from './styles';

// "HH:mm" (format de stockage, voir settingsStorage.ts) <-> Date attendu par
// DateTimePicker. Seules heures/minutes sont utilisées, le reste de la date
// n'a pas de sens ici et est ignoré.
function timeStrToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateToTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 4 toggles + le time picker multi-plateforme + les statuts d'erreur qui
// leur sont propres (notifError/reminderTimeError/le statut de
// reprogrammation posé par ReminderScheduler). Découpé hors de
// app/settings.tsx (474 lignes, UI+logique+styles mélangés) sans changement
// de comportement — voir aussi DataSection pour la carte "Données".
export default function NotificationsSection() {
  const { settings, updateSettings } = useSettings();
  const { error: reminderStatusError } = useReminderStatus();
  // Android n'a pas d'équivalent "compact" inline : le picker ne s'affiche
  // que sur demande (voir handleTimeChange, qui le referme après le choix).
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  // Message affiché si la demande de permission échoue (plateforme non
  // supportée ou refus de l'utilisateur) — voir requestPermissionOrExplain.
  const [notifError, setNotifError] = useState<string | undefined>();

  // Le picker natif (iOS/Android) ne peut pas produire de valeur invalide ;
  // seul le repli texte libre du web (voir plus bas) en a besoin.
  const reminderTimeError =
    Platform.OS === 'web' && settings.dailyReminder && !parseReminderTime(settings.reminderTime)
      ? 'Format invalide — utilise HH:mm (ex : 20:00).'
      : undefined;

  function handleTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    updateSettings({ reminderTime: dateToTimeStr(selected) });
  }

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
          <Toggle value={settings.dailyReminder} onChange={handleDailyReminderToggle} />
        </View>

        {settings.dailyReminder && (
          <View style={[s.row, s.rowBorder, styles.rowWrap]}>
            <View style={styles.timeRow}>
              <Text style={s.rowTitle}>Heure du rappel</Text>
              {Platform.OS === 'web' && (
                // @react-native-community/datetimepicker n'a pas d'implémentation
                // web (voir son fallback qui log un warning et rend null) : on
                // garde la saisie texte libre uniquement sur cette plateforme.
                <TextInput
                  style={styles.timeInput}
                  value={settings.reminderTime}
                  onChangeText={(v) => updateSettings({ reminderTime: v })}
                  placeholder="20:00"
                  placeholderTextColor={white(0.2)}
                />
              )}
              {Platform.OS === 'ios' && (
                <DateTimePicker
                  value={timeStrToDate(settings.reminderTime)}
                  mode="time"
                  display="compact"
                  onChange={handleTimeChange}
                />
              )}
              {Platform.OS === 'android' && (
                <>
                  <Pressable
                    style={styles.timeValueButton}
                    onPress={() => setShowAndroidPicker(true)}
                  >
                    <Text style={styles.timeValueText}>{settings.reminderTime}</Text>
                  </Pressable>
                  {showAndroidPicker && (
                    <DateTimePicker
                      value={timeStrToDate(settings.reminderTime)}
                      mode="time"
                      is24Hour
                      display="default"
                      onChange={handleTimeChange}
                    />
                  )}
                </>
              )}
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
          <Toggle value={settings.goalReachedNotifs} onChange={handleGoalReachedToggle} />
        </View>

        <View style={[s.row, s.rowBorder]}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>Objectif bientôt atteint 🎯</Text>
            <Text style={s.rowSubtitle}>Quand il ne reste que quelques % pour finir</Text>
          </View>
          <Toggle
            value={settings.almostThereNotifs}
            onChange={(v) => updateSettings({ almostThereNotifs: v })}
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
  timeInput: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.fg,
    minWidth: 72,
    textAlign: 'center',
  },
  timeValueButton: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  timeValueText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.fg,
  },
});
