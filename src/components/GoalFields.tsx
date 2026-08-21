import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Unit, UNIT_LABELS } from '../types';

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
      <Text style={styles.label}>Objectif</Text>
      <TextInput
        style={styles.input}
        placeholder="ex: Pompes"
        value={title}
        onChangeText={onTitleChange}
      />
      {titleError && <Text style={styles.errorText}>{titleError}</Text>}

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Cible</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 1000"
            keyboardType="numeric"
            value={targetValue}
            onChangeText={onTargetValueChange}
          />
          {targetValueError && <Text style={styles.errorText}>{targetValueError}</Text>}
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>{durationLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 30"
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
              {UNIT_LABELS[u]}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
