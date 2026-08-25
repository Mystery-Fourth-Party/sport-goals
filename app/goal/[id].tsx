import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GoalDetailHeader,
  GoalHistoryList,
  GoalProgressCard,
  ProgressEntryModal,
  RecentSessionsCard,
} from '../../src/components/goal-detail';
import { BackButton } from '../../src/components/ui';
import { confirmDestructive } from '../../src/confirm';
import { longDateLabel } from '../../src/dateLabels';
import { useGoals } from '../../src/goals-context';
import { useSettings } from '../../src/settings-context';
import { getGoalStats, parseDate, todayStr } from '../../src/stats';
import { colors, fontFamily, radius, spacing, white } from '../../src/theme';
import { Entry } from '../../src/types';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, addProgress, updateEntry, deleteEntry, deleteGoal } = useGoals();
  const { settings } = useSettings();
  const goal = goals.find((g) => g.id === id);

  // Un seul modal pour ajouter la progression du jour et pour corriger une
  // entrée passée depuis l'historique — même forme (valeur + unité +
  // bouton), seule la cible (addProgress vs updateEntry) et quelques
  // libellés diffèrent. `null` = fermé ; `date` vaut `today` en mode "add".
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [modalDate, setModalDate] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalError, setModalError] = useState(false);

  if (!goal) {
    // Objectif supprimé entre-temps (ou id invalide) : on ne peut pas
    // rendre le reste de l'écran sans lui, retour à la liste.
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.notFound}>Objectif introuvable.</Text>
      </SafeAreaView>
    );
  }

  const today = todayStr();
  const s = getGoalStats(goal, today);
  const remaining = goal.targetValue - s.actual;
  const showAlmostThere = settings.almostThereNotifs && s.progress >= 0.9 && s.progress < 1;

  const todayEntry = goal.entries.find((e) => e.date === today);

  function openAddModal() {
    setModalMode('add');
    setModalDate(today);
    setModalValue('');
    setModalError(false);
  }

  function openEditModal(entry: Entry) {
    setModalMode('edit');
    setModalDate(entry.date);
    setModalValue(String(entry.value));
    setModalError(false);
  }

  function closeModal() {
    setModalMode(null);
    setModalValue('');
    setModalError(false);
  }

  function handleSave() {
    const value = Number(modalValue);
    if (!value || value <= 0) {
      setModalError(true);
      return;
    }
    if (modalMode === 'add') {
      addProgress(goal!.id, value);
    } else if (modalMode === 'edit') {
      updateEntry(goal!.id, modalDate, value);
    }
    closeModal();
  }

  function handleDeleteEntry() {
    const date = modalDate;
    confirmDestructive({
      title: 'Supprimer cette entrée ?',
      message: longDateLabel(parseDate(date)),
      onConfirm: () => {
        deleteEntry(goal!.id, date);
        closeModal();
      },
    });
  }

  function handleDelete() {
    confirmDestructive({
      title: 'Supprimer cet objectif ?',
      message: goal!.title,
      onConfirm: () => {
        deleteGoal(goal!.id);
        router.back();
      },
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <GoalDetailHeader
        goal={goal}
        stats={s}
        remaining={remaining}
        showAlmostThere={showAlmostThere}
        onBack={() => router.back()}
        onEdit={() => router.push(`/goal/${goal.id}/edit`)}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <GoalProgressCard goal={goal} stats={s} />

        <RecentSessionsCard entries={goal.entries} unit={goal.unit} today={today} />

        <GoalHistoryList
          entries={goal.entries}
          unit={goal.unit}
          today={today}
          onEntryPress={openEditModal}
        />

        <Pressable style={styles.deleteLink} onPress={handleDelete} accessibilityRole="button">
          <Text style={styles.deleteLinkText}>🗑 Supprimer l&apos;objectif</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.ctaWrap}>
        <Pressable style={styles.ctaButton} onPress={openAddModal} accessibilityRole="button">
          <Text style={styles.ctaButtonText}>+ Ajouter la progression du jour</Text>
        </Pressable>
      </View>

      <ProgressEntryModal
        mode={modalMode}
        date={modalDate}
        value={modalValue}
        error={modalError}
        unit={goal.unit}
        todayEntry={todayEntry}
        onChangeValue={(v) => {
          setModalValue(v);
          setModalError(false);
        }}
        onClose={closeModal}
        onSave={handleSave}
        onDeleteEntry={handleDeleteEntry}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  // Utilisé par le seul retour "introuvable" ci-dessus (le header complet
  // vit désormais dans GoalDetailHeader, avec sa propre copie de ce style).
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 140,
    gap: spacing.gap,
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteLinkText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: 'rgba(239,68,68,0.6)',
  },
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 32,
    paddingTop: 16,
  },
  ctaButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notFound: {
    fontFamily: fontFamily.bodyRegular,
    color: white(0.4),
    textAlign: 'center',
    marginTop: 40,
  },
});
