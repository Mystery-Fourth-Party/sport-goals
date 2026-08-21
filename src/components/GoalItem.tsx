import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Goal, Unit, UNIT_LABELS } from '../types';
import GoalFields from './GoalFields';

interface Props {
  goal: Goal;
  // Chaque action remonte au parent (App), qui détient le state "goals" —
  // même pattern de lifting state up qu'en React web.
  onAddProgress: (goalId: string, amount: number) => void;
  onUpdate: (goalId: string, updates: Partial<Goal>) => void;
  onDelete: (goalId: string) => void;
}

function daysLeft(deadline: string): number {
  const diffMs = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function GoalItem({ goal, onAddProgress, onUpdate, onDelete }: Props) {
  const remaining = daysLeft(goal.deadline);
  // Barre visuelle clampée à 100%, mais currentValue peut dépasser
  // targetValue (objectif dépassé) sans que l'affichage ne casse.
  const progressRatio = Math.min(goal.currentValue / goal.targetValue, 1);
  const isComplete = goal.currentValue >= goal.targetValue;

  // Champ de saisie local à la carte : reste vide après chaque ajout,
  // n'a pas besoin d'être remonté au parent.
  const [amount, setAmount] = useState('');

  // État du formulaire d'édition, initialisé depuis goal à l'ouverture
  // (voir startEdit) puis modifié localement jusqu'à "Enregistrer".
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editTarget, setEditTarget] = useState(String(goal.targetValue));
  const [editUnit, setEditUnit] = useState<Unit>(goal.unit);
  const [editDays, setEditDays] = useState(String(Math.max(remaining, 0)));

  function handleAdd() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    onAddProgress(goal.id, value);
    setAmount('');
  }

  function startEdit() {
    setEditTitle(goal.title);
    setEditTarget(String(goal.targetValue));
    setEditUnit(goal.unit);
    setEditDays(String(Math.max(remaining, 0)));
    setIsEditing(true);
  }

  const canSaveEdit = editTitle.trim() !== '' && Number(editTarget) > 0 && Number(editDays) > 0;

  function handleSaveEdit() {
    if (!canSaveEdit) return;
    // On édite en "jours restants" plutôt qu'en date, pour rester cohérent
    // avec le formulaire de création (pas de date picker natif installé).
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + Number(editDays));
    onUpdate(goal.id, {
      title: editTitle.trim(),
      targetValue: Number(editTarget),
      unit: editUnit,
      deadline: deadline.toISOString(),
    });
    setIsEditing(false);
  }

  function handleDelete() {
    // Alert.alert() est un no-op sur web avec react-native-web : on bascule
    // sur window.confirm côté web pour garder une vraie confirmation.
    if (Platform.OS === 'web') {
      if (window.confirm(`Supprimer "${goal.title}" ?`)) onDelete(goal.id);
      return;
    }
    Alert.alert('Supprimer cet objectif ?', goal.title, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(goal.id) },
    ]);
  }

  if (isEditing) {
    return (
      <View style={styles.card}>
        <GoalFields
          title={editTitle}
          onTitleChange={setEditTitle}
          targetValue={editTarget}
          onTargetValueChange={setEditTarget}
          unit={editUnit}
          onUnitChange={setEditUnit}
          durationLabel="Jours restants"
          duration={editDays}
          onDurationChange={setEditDays}
        />
        <View style={styles.editActions}>
          <Pressable
            style={[styles.smallButton, styles.cancelButton]}
            onPress={() => setIsEditing(false)}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </Pressable>
          <Pressable
            style={[styles.smallButton, !canSaveEdit && styles.buttonDisabled]}
            onPress={handleSaveEdit}
            disabled={!canSaveEdit}
          >
            <Text style={styles.smallButtonText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{goal.title}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={startEdit} hitSlop={8}>
            <Text style={styles.actionIcon}>✏️</Text>
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Text style={styles.actionIcon}>🗑️</Text>
          </Pressable>
        </View>
      </View>

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 14,
  },
  actionIcon: {
    fontSize: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flexShrink: 1,
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
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  smallButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#444',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    backgroundColor: '#a9b8d6',
  },
});
