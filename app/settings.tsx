import { useState } from 'react';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Toggle } from '../src/components/ui';
import { useSettings } from '../src/settings-context';
import { colors, fontFamily, radius, spacing, white } from '../src/theme';

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

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  // Android n'a pas d'équivalent "compact" inline : le picker ne s'affiche
  // que sur demande (voir handleTimeChange, qui le referme après le choix).
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  function handleTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    updateSettings({ reminderTime: dateToTimeStr(selected) });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle}>Rappel quotidien</Text>
              <Text style={styles.rowSubtitle}>Pour entrer ta progression chaque jour</Text>
            </View>
            <Toggle
              value={settings.dailyReminder}
              onChange={(v) => updateSettings({ dailyReminder: v })}
            />
          </View>

          {settings.dailyReminder && (
            <View style={[styles.row, styles.rowBorder]}>
              <Text style={styles.rowTitle}>Heure du rappel</Text>
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
          )}

          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle}>Objectif atteint 🏆</Text>
              <Text style={styles.rowSubtitle}>Célébration quand un objectif est complété</Text>
            </View>
            <Toggle
              value={settings.goalReachedNotifs}
              onChange={(v) => updateSettings({ goalReachedNotifs: v })}
            />
          </View>

          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle}>Objectif bientôt atteint 🎯</Text>
              <Text style={styles.rowSubtitle}>Quand il ne reste que quelques % pour finir</Text>
            </View>
            <Toggle
              value={settings.almostThereNotifs}
              onChange={(v) => updateSettings({ almostThereNotifs: v })}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle}>Streak en danger 🔥</Text>
              <Text style={styles.rowSubtitle}>
                Si tu n&apos;as pas encore entré ta progression
              </Text>
            </View>
            <Toggle
              value={settings.streakAlert}
              onChange={(v) => updateSettings({ streakAlert: v })}
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Application</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowTitlePlain}>Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Objectif-sport</Text>
            <Text style={styles.betaValue}>Bêta</Text>
          </View>
        </View>

        <Text style={styles.watermark}>NO PAIN{'\n'}NO GAIN</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 20,
  },
  title: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 22,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.fg,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
  },
  sectionLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: white(0.3),
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionLabelSpaced: {
    marginTop: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 16,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: white(0.05),
  },
  rowTexts: {
    flexShrink: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.fg,
  },
  rowTitlePlain: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.fg,
  },
  rowSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 2,
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
  versionValue: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: white(0.35),
  },
  betaValue: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.brand,
  },
  watermark: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 32,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: white(0.04),
    textAlign: 'center',
    marginTop: 32,
  },
});
