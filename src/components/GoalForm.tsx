import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Goal, Unit, UNIT_LABELS } from '../types';

const UNITS: Unit[] = ['reps', 'km', 'min', 'h'];

interface Props {
  onCreate: (goal: Goal) => void;
}

export default function GoalForm({ onCreate }: Props) {
  // Formulaire contrôlé classique (comme en React web) : un useState par champ.
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState<Unit>('reps');
  const [durationDays, setDurationDays] = useState('');

  const canSubmit = title.trim() !== '' && Number(targetValue) > 0 && Number(durationDays) > 0;

  function handleSubmit() {
    if (!canSubmit) return;

    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + Number(durationDays));

    onCreate({
      // Date.now() suffit ici (pas de créations concurrentes possibles côté
      // UI) ; un crypto.randomUUID() serait plus robuste si ça change.
      id: String(Date.now()),
      title: title.trim(),
      targetValue: Number(targetValue),
      currentValue: 0,
      unit,
      createdAt: now.toISOString(),
      deadline: deadline.toISOString(),
    });

    setTitle('');
    setTargetValue('');
    setDurationDays('');
    setUnit('reps');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Objectif</Text>
      {/* TextInput = équivalent RN de <input>. keyboardType="numeric" fait
          apparaître le clavier numérique du téléphone sur les champs chiffrés. */}
      <TextInput
        style={styles.input}
        placeholder="ex: Pompes"
        value={title}
        onChangeText={setTitle}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Cible</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 1000"
            keyboardType="numeric"
            value={targetValue}
            onChangeText={setTargetValue}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Durée (jours)</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 30"
            keyboardType="numeric"
            value={durationDays}
            onChangeText={setDurationDays}
          />
        </View>
      </View>

      <Text style={styles.label}>Unité</Text>
      {/* Chips plutôt qu'un <select> : les selects natifs sont peu
          ergonomiques sur mobile, on préfère des boutons à sélection unique. */}
      <View style={styles.unitRow}>
        {UNITS.map((u) => (
          <Pressable
            key={u}
            onPress={() => setUnit(u)}
            style={[styles.chip, unit === u && styles.chipSelected]}
          >
            <Text style={[styles.chipText, unit === u && styles.chipTextSelected]}>
              {UNIT_LABELS[u]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Pressable = équivalent RN de <button onClick>. */}
      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        <Text style={styles.buttonText}>Créer l'objectif</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
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
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: '#a9b8d6',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
