import { StyleSheet, Text, View } from 'react-native';
import { Goal, UNIT_LABELS } from '../types';

interface Props {
  goal: Goal;
}

function daysLeft(deadline: string): number {
  const diffMs = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function GoalItem({ goal }: Props) {
  const remaining = daysLeft(goal.deadline);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{goal.title}</Text>
      <Text style={styles.target}>
        {goal.targetValue} {UNIT_LABELS[goal.unit]}
      </Text>
      <Text style={[styles.deadline, remaining < 0 && styles.overdue]}>
        {remaining >= 0 ? `${remaining} jour(s) restant(s)` : 'Délai dépassé'}
      </Text>
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
  deadline: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  overdue: {
    color: '#dc2626',
  },
});
