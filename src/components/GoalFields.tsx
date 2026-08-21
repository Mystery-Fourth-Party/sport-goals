import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Unit } from '../types';
import { colors, fontFamily, radius, spacing, white } from '../theme';

const UNITS: Unit[] = ['reps', 'km', 'min', 'h'];

interface Props {
  title: string;
  onTitleChange: (v: string) => void;
  targetValue: string;
  onTargetValueChange: (v: string) => void;
  unit: Unit;
  onUnitChange: (u: Unit) => void;
  // Le libellé du 3e champ change selon le contexte : "Durée (jours)" à la
  // création, "Jours restants" en édition (on ne rejoue pas la création).
  durationLabel: string;
  duration: string;
  onDurationChange: (v: string) => void;
  // Messages d'erreur optionnels affichés sous chaque champ concerné.
  // Laissés à undefined par les appelants qui ne veulent pas de validation
  // inline (ex: GoalItem en édition, qui garde le bouton désactivé).
  titleError?: string;
  targetValueError?: string;
  durationError?: string;
}

// Champs de saisie communs à la création (GoalForm) et à l'édition
// (GoalItem en mode édition). Purement contrôlé, sans bouton de
// validation : chaque appelant garde ses propres boutons/actions.
export default function GoalFields({
  title,
  onTitleChange,
  targetValue,
  onTargetValueChange,
  unit,
  onUnitChange,
  durationLabel,
  duration,
  onDurationChange,
  titleError,
  targetValueError,
  durationError,
}: Props) {
  return (
    <>
      <Text style={styles.label}>Nom de l&apos;objectif</Text>
      <TextInput
        style={styles.input}
        placeholder="ex : 1000 pompes en 30 jours"
        placeholderTextColor={white(0.2)}
        value={title}
        onChangeText={onTitleChange}
      />
      {titleError && <Text style={styles.errorText}>{titleError}</Text>}

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Valeur cible</Text>
          <TextInput
            style={[styles.input, styles.inputDisplay]}
            placeholder="1000"
            placeholderTextColor={white(0.2)}
            keyboardType="numeric"
            value={targetValue}
            onChangeText={onTargetValueChange}
          />
          {targetValueError && <Text style={styles.errorText}>{targetValueError}</Text>}
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>{durationLabel}</Text>
          <TextInput
            style={[styles.input, styles.inputDisplay]}
            placeholder="30"
            placeholderTextColor={white(0.2)}
            keyboardType="numeric"
            value={duration}
            onChangeText={onDurationChange}
          />
          {durationError && <Text style={styles.errorText}>{durationError}</Text>}
        </View>
      </View>

      <Text style={styles.label}>Unité</Text>
      <View style={styles.unitRow}>
        {UNITS.map((u) => (
          <Pressable
            key={u}
            onPress={() => onUnitChange(u)}
            style={[styles.chip, unit === u && styles.chipSelected]}
          >
            <Text style={[styles.chipText, unit === u && styles.chipTextSelected]}>
              {u.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: white(0.35),
    marginBottom: spacing.gap / 2,
  },
  errorText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.late,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: colors.fg,
  },
  inputDisplay: {
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: {
    flex: 1,
    gap: 6,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: white(0.08),
  },
  chipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    textTransform: 'uppercase',
    color: white(0.4),
  },
  chipTextSelected: {
    color: '#fff',
  },
});
