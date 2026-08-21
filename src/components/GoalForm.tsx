import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Goal, Unit } from '../types';
import GoalFields from './GoalFields';

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
      // Le global crypto.randomUUID() n'est pas garanti sur Hermes (natif) ;
      // expo-crypto fournit une implémentation fiable sur toutes les plateformes.
      id: Crypto.randomUUID(),
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
      <GoalFields
        title={title}
        onTitleChange={setTitle}
        targetValue={targetValue}
        onTargetValueChange={setTargetValue}
        unit={unit}
        onUnitChange={setUnit}
        durationLabel="Durée (jours)"
        duration={durationDays}
        onDurationChange={setDurationDays}
      />

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
