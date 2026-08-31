import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GoalCard from '../src/components/GoalCard';
import { fullDateLabel } from '../src/dateLabels';
import { useGoals } from '../src/goals-context';
import { splitGoalsByStatus, todayStr } from '../src/stats';
import { colors, fontFamily, radius, size, spacing, white } from '../src/theme';

export default function GoalListScreen() {
  const { t } = useTranslation();
  const { goals, loaded } = useGoals();
  const today = todayStr();
  const { active, completed } = splitGoalsByStatus(goals, today);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={active}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GoalCard goal={item} onPress={() => router.push(`/goal/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.dateLabel}>{fullDateLabel(new Date())}</Text>
                {/* Le titre est volontairement sur 2 lignes (le prototype
                    écrit "Mes<br />Objectifs", comme le watermark "NO PAIN
                    / NO GAIN" des Réglages) : on garde le saut de ligne
                    visuel mais on donne au lecteur d'écran la phrase d'un
                    seul tenant, sinon TalkBack marque une vraie pause au
                    milieu du titre. */}
                <Text style={styles.heading} accessibilityLabel={t('goalList.headingA11y')}>
                  {t('goalList.heading')}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.roundButton}
                  onPress={() => router.push('/weekly')}
                  accessibilityRole="button"
                  accessibilityLabel={t('goalList.weeklySummaryA11y')}
                >
                  <Text style={styles.roundButtonGlyph}>📊</Text>
                </Pressable>
                <Pressable
                  style={styles.roundButton}
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel={t('goalList.settingsA11y')}
                >
                  <Text style={styles.roundButtonGlyph}>⚙️</Text>
                </Pressable>
              </View>
            </View>

            {goals.length > 0 && (
              <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.statCardActive]}>
                  <Text style={[styles.statLabel, { color: colors.brand }]}>
                    {t('goalList.active')}
                  </Text>
                  <Text style={styles.statValue}>{active.length}</Text>
                </View>
                <Pressable
                  style={[styles.statCard, styles.statCardDone]}
                  onPress={() => router.push('/archive')}
                  accessibilityRole="button"
                  // Explicite plutôt que laissé à la concaténation par
                  // défaut : le chevron "›" seul ne veut rien dire pour un
                  // lecteur d'écran.
                  accessibilityLabel={t('goalList.completedA11y', { count: completed.length })}
                >
                  <View style={styles.statLabelRow}>
                    <Text style={[styles.statLabel, { color: colors.ahead }]}>
                      {t('goalList.completed')}
                    </Text>
                    <Text style={styles.statChevron}>›</Text>
                  </View>
                  <Text style={styles.statValue}>{completed.length}</Text>
                </Pressable>
                <View style={styles.statCard}>
                  <Text style={styles.statLabelMuted}>{t('goalList.total')}</Text>
                  <Text style={styles.statValue}>{goals.length}</Text>
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loaded ? null : goals.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitle}>{t('goalList.emptyNoGoalsTitle')}</Text>
              <Text style={styles.emptyText}>{t('goalList.emptyNoGoalsText')}</Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/create')}
                accessibilityRole="button"
              >
                <Text style={styles.emptyButtonText}>{t('goalList.createGoal')}</Text>
              </Pressable>
            </View>
          ) : (
            // Tous les objectifs existants sont terminés — pas la même
            // situation que "aucun objectif du tout" : message dédié plutôt
            // que de tomber dans le même état vide.
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyTitle}>{t('goalList.emptyAllDoneTitle')}</Text>
              <Text style={styles.emptyText}>{t('goalList.emptyAllDoneText')}</Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/archive')}
                accessibilityRole="button"
              >
                <Text style={styles.emptyButtonText}>{t('goalList.viewArchive')}</Text>
              </Pressable>
            </View>
          )
        }
      />

      {goals.length > 0 && (
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/create')}
          accessibilityRole="button"
          accessibilityLabel={t('goalList.createGoal')}
        >
          <Text style={styles.fabGlyph}>+</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: 100,
    gap: spacing.gap,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: white(0.35),
  },
  heading: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 34,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 36,
    color: colors.fg,
    marginTop: 4,
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  roundButton: {
    width: size.roundIconButton,
    height: size.roundIconButton,
    borderRadius: size.roundIconButton / 2,
    backgroundColor: white(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonGlyph: {
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statCardActive: {
    backgroundColor: 'rgba(255,107,0,0.1)',
    borderColor: 'rgba(255,107,0,0.15)',
  },
  statCardDone: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.15)',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Légère affordance visuelle : la carte "Terminés" est pressable
  // (navigue vers /archive), contrairement aux deux autres.
  statChevron: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.ahead,
    opacity: 0.6,
  },
  statLabelMuted: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.35)',
  },
  statValue: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 22,
    color: colors.fg,
    marginTop: 2,
  },
  separator: {
    height: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 26,
    textTransform: 'uppercase',
    color: colors.fg,
  },
  emptyText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: white(0.4),
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyButtonText: {
    color: '#fff',
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: size.fab,
    height: size.fab,
    borderRadius: size.fab / 2,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabGlyph: {
    color: '#fff',
    fontSize: 28,
    fontFamily: fontFamily.displayRegular,
    marginTop: -2,
  },
});
