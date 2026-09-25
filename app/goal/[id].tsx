import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { parsePositiveNumber } from '../../src/goalValidation';
import { useSettings } from '../../src/settings-context';
import { getGoalStats, isGoalClosed, isSuccessStatus, parseDate } from '../../src/stats';
import { useToday } from '../../src/useToday';
import { colors, fontFamily, radius, spacing, white } from '../../src/theme';
import { Entry } from '../../src/types';

export default function GoalDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, loaded, addProgress, updateEntry, deleteEntry, deleteGoal } = useGoals();
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
  // Appelé avant le retour anticipé ci-dessous : les Hooks doivent être
  // appelés dans le même ordre à chaque rendu, y compris quand l'objectif
  // est introuvable.
  const today = useToday();

  if (!loaded || !goal) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        {/* Le message n'apparaît qu'une fois le chargement terminé. Avant, on
            ne sait pas encore si l'objectif existe : l'écran annonçait un
            objectif introuvable qui existait très bien, le temps que
            loadGoals résolve — visible sur un lien profond, une notification
            ou un tap rapide après un démarrage à froid. Même garde que celle
            posée sur l'écran d'édition en PR #25, sans le remount : aucun
            useState de cet écran n'est initialisé depuis `goal`, les quatre
            servent au modal. L'en-tête est rendu dans les deux cas, pour que
            le bouton retour existe aussi pendant l'attente. */}
        {loaded && <Text style={styles.notFound}>{t('goalDetail.notFound')}</Text>}
      </SafeAreaView>
    );
  }

  const s = getGoalStats(goal, today);
  const remaining = goal.targetValue - s.actual;
  // Objectif clos = archive en lecture seule : ni modification (voir la
  // garde de EditGoalScreen), ni ajout du jour (voir la garde d'addProgress
  // dans goals-context.tsx), ni encouragement « presque là ». La modification
  // est la plus dangereuse : « Jours restants » y est pré-rempli à
  // max(1, remainingDays) et enregistrer recalcule l'échéance depuis
  // aujourd'hui, ce qui ressusciterait l'objectif. Correction et suppression
  // d'entrées, suppression de l'objectif : inchangées.
  const closed = isGoalClosed(goal, today);
  // Statut plutôt que `progress < 1` : une somme flottante un epsilon sous
  // la cible est déjà « atteint » (voir roundProgress dans stats.ts).
  const showAlmostThere =
    settings.almostThereNotifs && !closed && s.progress >= 0.9 && !isSuccessStatus(s.status);

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
    // parsePositiveNumber plutôt que `!value || value <= 0` : ce test
    // laissait passer Infinity (saisie "1e400"), voir src/goalValidation.ts.
    // La porte est ici et non dans ProgressEntryModal : son bouton n'est
    // que grisé par un style, il reste pressable et appelle ce handler.
    const value = parsePositiveNumber(modalValue);
    if (value === null) {
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
      title: t('goalDetail.deleteEntryConfirmTitle'),
      message: longDateLabel(parseDate(date)),
      onConfirm: () => {
        deleteEntry(goal!.id, date);
        closeModal();
      },
    });
  }

  function handleDelete() {
    confirmDestructive({
      title: t('goalDetail.deleteGoalConfirmTitle'),
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
        onEdit={closed ? undefined : () => router.push(`/goal/${goal.id}/edit`)}
        closed={closed}
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
          <Text style={styles.deleteLinkText}>{t('goalDetail.deleteGoal')}</Text>
        </Pressable>
      </ScrollView>

      {!closed && (
        <View style={styles.ctaWrap}>
          <Pressable style={styles.ctaButton} onPress={openAddModal} accessibilityRole="button">
            <Text style={styles.ctaButtonText}>{t('goalDetail.addProgressCta')}</Text>
          </Pressable>
        </View>
      )}

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
