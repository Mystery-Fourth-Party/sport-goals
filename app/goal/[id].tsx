import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, BarChart, ProgressBar, StatusBadge } from '../../src/components/ui';
import { confirmDestructive } from '../../src/confirm';
import { longDateLabel, weekdayShort } from '../../src/dateLabels';
import { useGoals } from '../../src/goals-context';
import { useSettings } from '../../src/settings-context';
import { fmt, getGoalStats, parseDate, todayStr } from '../../src/stats';
import { colors, fontFamily, radius, spacing, statusColors, white } from '../../src/theme';
import { Entry, UNIT_ICONS, UNIT_LABELS } from '../../src/types';

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

  const recentEntries = goal.entries.filter((e) => e.value > 0).slice(-7);
  const historyEntries = [...goal.entries].reverse().slice(0, 12);
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.headerTexts}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>{UNIT_ICONS[goal.unit]}</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {goal.title}
              </Text>
            </View>
            <Text style={styles.headerMeta}>
              Jour {s.elapsedDays} / {s.totalDays} · {s.remainingDays}j restants
            </Text>
          </View>
          <Pressable
            style={styles.editButton}
            onPress={() => router.push(`/goal/${goal.id}/edit`)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Modifier l'objectif"
          >
            <Text style={styles.editGlyph}>✎</Text>
          </Pressable>
          <StatusBadge status={s.status} />
        </View>

        {s.status === 'late' && (
          <View style={[styles.banner, styles.bannerLate]}>
            <Text style={styles.bannerEmoji}>⚠️</Text>
            <View style={styles.bannerTexts}>
              <Text style={[styles.bannerTitle, { color: colors.late }]}>
                Tu es en retard sur le rythme
              </Text>
              <Text style={styles.bannerSubtitle}>
                {fmt(s.dailyRequired, goal.unit)} {UNIT_LABELS[goal.unit]}/jour pour rattraper le
                retard
              </Text>
            </View>
          </View>
        )}
        {s.status === 'ahead' && !showAlmostThere && (
          <View style={[styles.banner, styles.bannerAhead]}>
            <Text style={styles.bannerEmoji}>🔥</Text>
            <View style={styles.bannerTexts}>
              <Text style={[styles.bannerTitle, { color: colors.ahead }]}>
                En avance sur le planning !
              </Text>
              <Text style={styles.bannerSubtitle}>
                Plus que {fmt(remaining, goal.unit)} {UNIT_LABELS[goal.unit]} à accomplir
              </Text>
            </View>
          </View>
        )}
        {showAlmostThere && (
          <View style={[styles.banner, styles.bannerAlmost]}>
            <Text style={styles.bannerEmoji}>🎯</Text>
            <View style={styles.bannerTexts}>
              <Text style={[styles.bannerTitle, { color: colors.almostThere }]}>Presque là !</Text>
              <Text style={styles.bannerSubtitle}>
                Plus que {fmt(remaining, goal.unit)} {UNIT_LABELS[goal.unit]} avant l&apos;objectif
                — continue !
              </Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.label}>Progression totale</Text>
              <Text style={styles.progressValue}>
                {fmt(s.actual, goal.unit)}
                <Text style={styles.progressValueMuted}>
                  {' '}
                  / {goal.targetValue} {UNIT_LABELS[goal.unit]}
                </Text>
              </Text>
            </View>
            <View style={styles.progressPercentBlock}>
              <Text style={[styles.progressPercent, { color: statusColors[s.status].text }]}>
                {(s.progress * 100).toFixed(0)}%
              </Text>
              <Text style={styles.expectedLabel}>
                Attendu {(s.expectedProgress * 100).toFixed(0)}%
              </Text>
            </View>
          </View>

          <ProgressBar value={s.progress} status={s.status} thick />

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.label}>Streak</Text>
              <Text style={[styles.statValue, { color: colors.brand }]}>
                {s.streak} <Text style={styles.statValueSuffix}>🔥</Text>
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.label}>Rythme actuel</Text>
              <Text style={styles.statValue}>
                {s.elapsedDays > 0 ? fmt(s.actual / s.elapsedDays, goal.unit) : '—'}
                <Text style={styles.statValueSuffix}>/j</Text>
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.label}>Requis</Text>
              <Text style={[styles.statValue, s.status === 'late' && { color: colors.late }]}>
                {fmt(s.dailyRequired, goal.unit)}
                <Text style={styles.statValueSuffix}>/j</Text>
              </Text>
            </View>
          </View>
        </View>

        {recentEntries.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.label, styles.cardSectionLabel]}>Dernières séances</Text>
            <BarChart
              bars={recentEntries.map((e) => {
                const d = parseDate(e.date);
                return {
                  key: e.date,
                  label: weekdayShort(d),
                  value: e.value,
                  valueLabel: fmt(e.value, goal.unit),
                  highlighted: e.date === today,
                };
              })}
            />
          </View>
        )}

        <View style={[styles.card, styles.historyCard]}>
          <Text style={[styles.label, styles.historyHeader]}>Historique</Text>
          {historyEntries.map((entry, i) => {
            const d = parseDate(entry.date);
            const isToday = entry.date === today;
            const entryAccessibilityLabel =
              entry.value > 0
                ? `${longDateLabel(d)}, ${fmt(entry.value, goal.unit)} ${UNIT_LABELS[goal.unit]}`
                : `${longDateLabel(d)}, aucune entrée`;
            return (
              <Pressable
                key={entry.date}
                onPress={() => openEditModal(entry)}
                style={[
                  styles.historyRow,
                  i < historyEntries.length - 1 && styles.historyRowBorder,
                  isToday && styles.historyRowToday,
                ]}
                accessibilityRole="button"
                accessibilityLabel={entryAccessibilityLabel}
              >
                <View style={styles.historyLeft}>
                  <View style={[styles.historyDot, entry.value > 0 && styles.historyDotActive]} />
                  <Text style={styles.historyDate}>
                    {longDateLabel(d)}
                    {isToday && <Text style={styles.historyToday}> (auj.)</Text>}
                  </Text>
                </View>
                <Text style={styles.historyValue}>
                  {entry.value > 0
                    ? `${fmt(entry.value, goal.unit)} ${UNIT_LABELS[goal.unit]}`
                    : '—'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.deleteLink} onPress={handleDelete} accessibilityRole="button">
          <Text style={styles.deleteLinkText}>🗑 Supprimer l&apos;objectif</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.ctaWrap}>
        <Pressable style={styles.ctaButton} onPress={openAddModal} accessibilityRole="button">
          <Text style={styles.ctaButtonText}>+ Ajouter la progression du jour</Text>
        </Pressable>
      </View>

      <Modal
        visible={modalMode !== null}
        transparent
        animationType="slide"
        // Cantonne le lecteur d'écran au contenu du modal tant qu'il est ouvert.
        accessibilityViewIsModal
      >
        {/* accessible={false} plutôt que accessibilityRole="button" : exposer
            toute la zone derrière le modal comme un "bouton" plein écran au
            lecteur d'écran serait plus perturbant qu'utile (cible géante,
            fait doublon avec "Annuler" dans la feuille — voir la doc RN sur
            ce pattern backdrop). Pas de importantForAccessibility
            "no-hide-descendants" ici : contrairement au cas générique où le
            backdrop n'a pas de descendant réel, la feuille modale (avec tout
            son contenu accessible) est nichée DANS ce Pressable pour que le
            tap dessus stoppe la propagation — la masquer masquerait le modal
            entier sur Android. accessible={false} n'affecte que ce
            Pressable lui-même, pas ses enfants. */}
        <Pressable style={styles.modalBackdrop} onPress={closeModal} accessible={false}>
          {/* Empêche le tap sur la feuille elle-même de remonter au backdrop
              et de fermer le modal par erreur. */}
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'add' ? "Aujourd'hui" : 'Modifier'}
              </Text>
              <Text style={styles.modalDate}>
                {modalDate && longDateLabel(parseDate(modalDate))}
              </Text>
            </View>
            {modalMode === 'add' && todayEntry && todayEntry.value > 0 && (
              <Text style={styles.modalAlready}>
                Déjà enregistré :{' '}
                <Text style={styles.modalAlreadyValue}>
                  {fmt(todayEntry.value, goal.unit)} {UNIT_LABELS[goal.unit]}
                </Text>
              </Text>
            )}
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={white(0.2)}
                keyboardType="numeric"
                autoFocus
                value={modalValue}
                onChangeText={(v) => {
                  setModalValue(v);
                  setModalError(false);
                }}
              />
              <View style={styles.modalUnitBox}>
                <Text style={styles.modalUnitText}>{UNIT_LABELS[goal.unit]}</Text>
              </View>
            </View>
            {modalError && (
              <Text style={styles.modalErrorText}>Entre une valeur supérieure à 0.</Text>
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={closeModal}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  !(Number(modalValue) > 0) && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleSave}
                accessibilityRole="button"
              >
                <Text style={styles.modalConfirmText}>Enregistrer</Text>
              </Pressable>
            </View>
            {modalMode === 'edit' && (
              <Pressable
                style={styles.deleteLink}
                onPress={handleDeleteEntry}
                accessibilityRole="button"
              >
                <Text style={styles.deleteLinkText}>🗑 Supprimer cette entrée</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTexts: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.fg,
  },
  headerMeta: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 2,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: white(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGlyph: {
    color: white(0.6),
    fontSize: 14,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerLate: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.2)',
  },
  bannerAhead: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  bannerAlmost: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.2)',
  },
  bannerEmoji: {
    fontSize: 18,
  },
  bannerTexts: {
    flexShrink: 1,
  },
  bannerTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
  },
  bannerSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.45),
    marginTop: 2,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 140,
    gap: spacing.gap,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.cardPadding,
  },
  label: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: white(0.35),
  },
  cardSectionLabel: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  progressValue: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 34,
    color: colors.fg,
    marginTop: 4,
  },
  progressValueMuted: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 16,
    color: white(0.35),
  },
  progressPercentBlock: {
    alignItems: 'flex-end',
  },
  progressPercent: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 28,
  },
  expectedLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.25),
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: white(0.08),
  },
  statValue: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 18,
    color: colors.fg,
    marginTop: 4,
  },
  statValueSuffix: {
    fontSize: 12,
    color: white(0.35),
  },
  historyCard: {
    padding: 0,
    overflow: 'hidden',
  },
  historyHeader: {
    paddingHorizontal: spacing.cardPadding,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: white(0.05),
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 12,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: white(0.04),
  },
  historyRowToday: {
    backgroundColor: 'rgba(255,107,0,0.05)',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: white(0.15),
  },
  historyDotActive: {
    backgroundColor: colors.brand,
  },
  historyDate: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: white(0.8),
    textTransform: 'capitalize',
  },
  historyToday: {
    color: colors.brand,
    fontSize: 11,
  },
  historyValue: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: colors.fg,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: white(0.08),
    padding: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: white(0.2),
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 22,
    textTransform: 'uppercase',
    color: colors.fg,
  },
  modalDate: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    textTransform: 'uppercase',
    color: colors.brand,
  },
  modalAlready: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: white(0.4),
    marginTop: 8,
  },
  modalAlreadyValue: {
    color: white(0.7),
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalInput: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: radius.button,
    paddingVertical: 16,
    textAlign: 'center',
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 28,
    color: colors.fg,
  },
  modalUnitBox: {
    width: 64,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalUnitText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: white(0.5),
  },
  modalErrorText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.late,
    marginTop: 8,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: white(0.08),
  },
  modalCancelText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    textTransform: 'uppercase',
    color: white(0.6),
  },
  modalConfirmButton: {
    backgroundColor: colors.brand,
  },
  modalConfirmButtonDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 13,
    textTransform: 'uppercase',
    color: '#fff',
  },
});
