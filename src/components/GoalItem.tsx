import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Goal, Unit, UNIT_ICONS, UNIT_LABELS } from '../types';
import { fmt, getGoalStats, todayStr } from '../stats';
import { colors, fontFamily, radius, spacing, statusColors, white } from '../theme';
import { ProgressBar, StatusBadge } from './ui';
import GoalFields from './GoalFields';

interface Props {
  goal: Goal;
  // Chaque action remonte au parent (App), qui détient le state "goals" —
  // même pattern de lifting state up qu'en React web.
  onAddProgress: (goalId: string, amount: number) => void;
  onUpdate: (goalId: string, updates: Partial<Goal>) => void;
  onDelete: (goalId: string) => void;
}

export default function GoalItem({ goal, onAddProgress, onUpdate, onDelete }: Props) {
  const today = todayStr();
  const s = getGoalStats(goal, today);

  // Champ de saisie local à la carte : reste vide après chaque ajout,
  // n'a pas besoin d'être remonté au parent.
  const [amount, setAmount] = useState('');

  // État du formulaire d'édition, initialisé depuis goal à l'ouverture
  // (voir startEdit) puis modifié localement jusqu'à "Enregistrer".
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editTarget, setEditTarget] = useState(String(goal.targetValue));
  const [editUnit, setEditUnit] = useState<Unit>(goal.unit);
  const [editDays, setEditDays] = useState(String(Math.max(s.remainingDays, 0)));
  // Comme dans GoalForm : les erreurs ne s'affichent qu'après une première
  // tentative de sauvegarde invalide, pas dès l'ouverture du formulaire.
  const [saveAttempted, setSaveAttempted] = useState(false);

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
    setEditDays(String(Math.max(s.remainingDays, 0)));
    setSaveAttempted(false);
    setIsEditing(true);
  }

  const editTitleError = editTitle.trim() === '' ? "Le titre de l'objectif est requis." : undefined;
  const editTargetNum = Number(editTarget);
  // La cible ne peut pas descendre sous ce qui a déjà été accompli (voir
  // EditGoalScreen dans le prototype) : sinon la progression dépasserait
  // instantanément 100% de façon incohérente.
  const editTargetError =
    editTargetNum > 0
      ? editTargetNum < s.actual
        ? `La cible doit être ≥ à ce qui est déjà accompli (${fmt(s.actual, editUnit)} ${UNIT_LABELS[editUnit]}).`
        : undefined
      : 'La valeur cible doit être un nombre positif.';
  const editDaysError =
    Number(editDays) > 0 ? undefined : 'Les jours restants doivent être un nombre positif.';
  const canSaveEdit = !editTitleError && !editTargetError && !editDaysError;

  function handleSaveEdit() {
    if (!canSaveEdit) {
      setSaveAttempted(true);
      return;
    }
    // On édite en "jours restants" plutôt qu'en date, pour rester cohérent
    // avec le formulaire de création (pas de date picker natif installé).
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + Number(editDays));
    onUpdate(goal.id, {
      title: editTitle.trim(),
      targetValue: editTargetNum,
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
          titleError={saveAttempted ? editTitleError : undefined}
          targetValueError={saveAttempted ? editTargetError : undefined}
          durationError={saveAttempted ? editDaysError : undefined}
        />
        <View style={styles.editActions}>
          <Pressable
            style={[styles.smallButton, styles.cancelButton]}
            onPress={() => setIsEditing(false)}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </Pressable>
          {/* Reste toujours actif, comme dans GoalForm : une tentative de
              sauvegarde invalide affiche les erreurs inline plutôt que de
              simplement ignorer le press. */}
          <Pressable style={styles.smallButton} onPress={handleSaveEdit}>
            <Text style={styles.smallButtonText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.icon}>
            <Text style={styles.iconGlyph}>{UNIT_ICONS[goal.unit]}</Text>
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.title} numberOfLines={1}>
              {goal.title}
            </Text>
            {/* remainingDays est toujours clampé à 0 minimum (stats.ts) : le
                statut "en retard" est déjà porté par le badge et le message
                ci-dessous, pas besoin d'un texte "délai dépassé" séparé ici
                (voir GoalCard dans le prototype, qui fait pareil). */}
            <Text style={styles.remaining}>{s.remainingDays}j restants</Text>
          </View>
        </View>
        <StatusBadge status={s.status} />
      </View>

      <ProgressBar value={s.progress} status={s.status} />

      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {fmt(s.actual, goal.unit)}
          <Text style={styles.valueMuted}>
            {' '}
            / {goal.targetValue} {UNIT_LABELS[goal.unit]}
          </Text>
        </Text>
        <Text style={[styles.percent, { color: statusColors[s.status].text }]}>
          {(s.progress * 100).toFixed(0)}%
        </Text>
      </View>

      {s.status === 'late' && (
        <Text style={styles.lateHint}>
          ↑ {fmt(s.dailyRequired, goal.unit)} {UNIT_LABELS[goal.unit]}/jour nécessaires pour
          rattraper
        </Text>
      )}
      {s.status === 'ahead' && (
        <Text style={styles.aheadHint}>
          🔥 {s.streak} jour(s) consécutif(s) · en avance sur le planning
        </Text>
      )}

      <View style={styles.footerRow}>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder={`+ ${UNIT_LABELS[goal.unit]}`}
            placeholderTextColor={white(0.25)}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <Pressable style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Ajouter</Text>
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={startEdit} hitSlop={8}>
            <Text style={styles.actionIcon}>✏️</Text>
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Text style={styles.actionIcon}>🗑️</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,107,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
  },
  headerTexts: {
    flexShrink: 1,
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.fg,
  },
  remaining: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 14,
  },
  actionIcon: {
    fontSize: 16,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 22,
    color: colors.fg,
  },
  valueMuted: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: white(0.35),
  },
  percent: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
  },
  lateHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: 'rgba(239,68,68,0.75)',
  },
  aheadHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: 'rgba(34,197,94,0.75)',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  addRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: radius.button,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.fg,
  },
  addButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  smallButton: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: white(0.08),
  },
  cancelButtonText: {
    color: white(0.6),
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    textTransform: 'uppercase',
  },
});
