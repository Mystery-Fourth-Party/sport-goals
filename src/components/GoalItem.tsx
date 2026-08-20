import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Goal, UNIT_LABELS } from '../types';

interface Props {
  goal: Goal;
  // Remonte la quantité ajoutée au parent (App), qui détient le state
  // "goals" — même pattern de lifting state up qu'en React web.
  onAddProgress: (goalId: string, amount: number) => void;
}

function daysLeft(deadline: string): number {
  const diffMs = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function GoalItem({ goal, onAddProgress }: Props) {
  const remaining = daysLeft(goal.deadline);
  // Barre visuelle clampée à 100%, mais currentValue peut dépasser
  // targetValue (objectif dépassé) sans que l'affichage ne casse.
  const progressRatio = Math.min(goal.currentValue / goal.targetValue, 1);
  const isComplete = goal.currentValue >= goal.targetValue;

  // Champ de saisie local à la carte : reste vide après chaque ajout,
  // n'a pas besoin d'être remonté au parent.
  const [amount, setAmount] = useState('');

  function handleAdd() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    onAddProgress(goal.id, value);
    setAmount('');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{goal.title}</Text>
      <Text style={styles.target}>
        {goal.currentValue} / {goal.targetValue} {UNIT_LABELS[goal.unit]}
      </Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressRatio * 100}%` },
            isComplete && styles.progressFillComplete,
          ]}
        />
      </View>

      <Text style={[styles.deadline, remaining < 0 && styles.overdue]}>
        {remaining >= 0 ? `${remaining} jour(s) restant(s)` : 'Délai dépassé'}
      </Text>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder={`+ ${UNIT_LABELS[goal.unit]}`}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f4f6fb',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  target: {
    fontSize: 14,
    color: '#333',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e6f0',
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressFillComplete: {
    backgroundColor: '#16a34a',
  },
  deadline: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  overdue: {
    color: '#dc2626',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
