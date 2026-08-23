import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, fontFamily, white } from '../../theme';

interface Props {
  // "HH:mm" — même format que Settings.reminderTime/Goal.reminderTime.
  value: string;
  onChange: (v: string) => void;
}

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

// Sélecteur d'heure multi-plateforme : web (saisie texte libre —
// @react-native-community/datetimepicker n'a pas d'implémentation web, voir
// son fallback qui log un warning et rend null), iOS (DateTimePicker
// "compact" inline), Android (bouton + picker à la demande, seule
// plateforme sans équivalent "compact" inline). Extrait de
// NotificationsSection pour être réutilisé par le réglage par-objectif (voir
// GoalFields) — API volontairement minimale (value/onChange), l'état
// d'affichage du picker Android reste interne.
export default function TimeField({ value, onChange }: Props) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  function handleTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(dateToTimeStr(selected));
  }

  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={styles.timeInput}
        value={value}
        onChangeText={onChange}
        placeholder="20:00"
        placeholderTextColor={white(0.2)}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={timeStrToDate(value)}
        mode="time"
        display="compact"
        onChange={handleTimeChange}
      />
    );
  }

  return (
    <>
      <Pressable style={styles.timeValueButton} onPress={() => setShowAndroidPicker(true)}>
        <Text style={styles.timeValueText}>{value}</Text>
      </Pressable>
      {showAndroidPicker && (
        <DateTimePicker
          value={timeStrToDate(value)}
          mode="time"
          is24Hour
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
