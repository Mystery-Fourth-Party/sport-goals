import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, BarChart, ProgressBar, StatusBadge } from '../src/components/ui';
import { weekdayShort, weekRangeLabel } from '../src/dateLabels';
import { useGoals } from '../src/goals-context';
import { fmt, getGoalStats, getWeeklyStats, parseDate, todayStr } from '../src/stats';
import { colors, fontFamily, radius, spacing, white } from '../src/theme';
import { Goal, UNIT_ICONS } from '../src/types';

function weekTotalFor(goal: Goal, weekDates: string[]): number {
  const weekSet = new Set(weekDates);
  return goal.entries.filter((e) => weekSet.has(e.date)).reduce((sum, e) => sum + e.value, 0);
}

export default function WeeklyScreen() {
  const { t } = useTranslation();
  const { goals } = useGoals();
  const today = todayStr();
  const { weekDates, sessionsPerDay, activeDays, totalSessions, mostAdvanced, mostBehind } =
    getWeeklyStats(goals, today);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View>
          <Text style={styles.title}>{t('weekly.title')}</Text>
          <Text style={styles.subtitle}>
            {weekRangeLabel(parseDate(weekDates[0]), parseDate(weekDates[weekDates.length - 1]))}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topStatsRow}>
          <View style={styles.card}>
            <Text style={styles.label}>{t('weekly.activeDays')}</Text>
            <Text style={styles.bigValue}>
              {activeDays}
              <Text style={styles.bigValueMuted}> / 7</Text>
            </Text>
            <View style={styles.dotsRow}>
              {sessionsPerDay.map((d) => (
                <View key={d.date} style={[styles.dot, d.count > 0 && styles.dotActive]} />
              ))}
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>{t('weekly.sessions')}</Text>
            <Text style={styles.bigValue}>{totalSessions}</Text>
            <Text style={styles.cardFootnote}>{t('weekly.thisWeek')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.label, styles.cardSectionLabel]}>{t('weekly.sessionsPerDay')}</Text>
          <BarChart
            showZeroValueLabel={false}
            bars={sessionsPerDay.map((d, i) => ({
              key: d.date,
              label: weekdayShort(parseDate(d.date)),
              value: d.count,
              highlighted: i === sessionsPerDay.length - 1,
            }))}
          />
        </View>

        {mostAdvanced && (
          <View style={[styles.card, styles.listCard]}>
            <Text style={[styles.label, styles.listCardHeader]}>{t('weekly.mostAdvanced')}</Text>
            <View style={styles.goalRow}>
              <View style={styles.goalRowTop}>
                <View style={styles.goalRowLeft}>
                  <View style={[styles.goalIcon, styles.goalIconAdvanced]}>
                    <Text style={styles.goalIconGlyph}>{UNIT_ICONS[mostAdvanced.goal.unit]}</Text>
                  </View>
                  <View>
                    <Text style={styles.goalTitle}>{mostAdvanced.goal.title}</Text>
                    <Text style={styles.goalSubtitle}>
                      {fmt(mostAdvanced.stats.actual, mostAdvanced.goal.unit)} /{' '}
                      {mostAdvanced.goal.targetValue}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.goalPercent, { color: colors.ahead }]}>
                  {(mostAdvanced.stats.progress * 100).toFixed(0)}%
                </Text>
              </View>
              <ProgressBar value={mostAdvanced.stats.progress} status={mostAdvanced.stats.status} />
            </View>
          </View>
        )}

        {mostBehind && (
          <View style={[styles.card, styles.listCard]}>
            <Text style={[styles.label, styles.listCardHeader]}>
              {mostBehind.stats.status === 'late'
                ? t('weekly.mostLate')
                : t('weekly.leastAdvanced')}
            </Text>
            <View style={styles.goalRow}>
              <View style={styles.goalRowTop}>
                <View style={styles.goalRowLeft}>
                  <View style={[styles.goalIcon, styles.goalIconBehind]}>
                    <Text style={styles.goalIconGlyph}>{UNIT_ICONS[mostBehind.goal.unit]}</Text>
                  </View>
                  <View>
                    <Text style={styles.goalTitle}>{mostBehind.goal.title}</Text>
                    <Text style={styles.goalSubtitle}>
                      {t('weekly.expectedActual', {
                        expected: (mostBehind.stats.expectedProgress * 100).toFixed(0),
                        actual: (mostBehind.stats.progress * 100).toFixed(0),
                      })}
                    </Text>
                  </View>
                </View>
                <StatusBadge status={mostBehind.stats.status} />
              </View>
              <ProgressBar value={mostBehind.stats.progress} status={mostBehind.stats.status} />
              {mostBehind.stats.status === 'late' && mostBehind.stats.dailyRequired > 0 && (
                <Text style={styles.behindHint}>
                  {t('weekly.catchUpHint', {
                    value: fmt(mostBehind.stats.dailyRequired, mostBehind.goal.unit),
                  })}
                </Text>
              )}
            </View>
          </View>
        )}

        {goals.length > 0 && (
          <View style={[styles.card, styles.listCard]}>
            <Text style={[styles.label, styles.listCardHeader]}>{t('weekly.allGoals')}</Text>
            {goals.map((g, i) => {
              const stats = getGoalStats(g, today);
              const weekTotal = weekTotalFor(g, weekDates);
              return (
                <View
                  key={g.id}
                  style={[styles.goalBreakdownRow, i < goals.length - 1 && styles.rowBorder]}
                >
                  <View style={styles.goalBreakdownTop}>
                    <View style={styles.goalRowLeft}>
                      <Text style={styles.goalBreakdownIcon}>{UNIT_ICONS[g.unit]}</Text>
                      <Text style={styles.goalTitle}>{g.title}</Text>
                    </View>
                    <Text style={styles.goalBreakdownTotal}>
                      {t('weekly.weekTotal', {
                        value: fmt(weekTotal, g.unit),
                        unit: t(`unit.${g.unit}`),
                      })}
                    </Text>
                  </View>
                  <ProgressBar value={stats.progress} status={stats.status} />
                </View>
              );
            })}
          </View>
        )}

        {goals.length === 0 && <Text style={styles.empty}>{t('weekly.empty')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 20,
  },
  title: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 22,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.fg,
  },
  subtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: spacing.gap,
  },
  topStatsRow: {
    flexDirection: 'row',
    gap: spacing.gap,
  },
  card: {
    flex: 1,
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
    marginBottom: 4,
  },
  cardSectionLabel: {
    marginBottom: 20,
  },
  bigValue: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 34,
    color: colors.fg,
    lineHeight: 36,
  },
  bigValueMuted: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 16,
    color: white(0.35),
  },
  cardFootnote: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
  },
  dot: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: white(0.1),
  },
  dotActive: {
    backgroundColor: colors.brand,
  },
  listCard: {
    padding: 0,
  },
  listCardHeader: {
    paddingHorizontal: spacing.cardPadding,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: white(0.05),
  },
  goalRow: {
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 16,
    gap: 12,
  },
  goalRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconAdvanced: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  goalIconBehind: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  goalIconGlyph: {
    fontSize: 16,
  },
  goalTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: colors.fg,
  },
  goalSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 2,
  },
  goalPercent: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 22,
  },
  behindHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: 'rgba(239,68,68,0.75)',
  },
  goalBreakdownRow: {
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 14,
    gap: 8,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: white(0.04),
  },
  goalBreakdownTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalBreakdownIcon: {
    fontSize: 15,
  },
  // flexShrink: 0 — le libellé d'unité traduit ("répétitions", "minutes")
  // est bien plus long que la clé technique affichée jusqu'ici : sans ça,
  // "+45 minutes" se coupait en deux face à un titre long. C'est le titre
  // (goalRowLeft, flexShrink: 1) qui absorbe la contrainte.
  goalBreakdownTotal: {
    flexShrink: 0,
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: white(0.6),
  },
  empty: {
    fontFamily: fontFamily.bodyRegular,
    color: white(0.4),
    textAlign: 'center',
    marginTop: 24,
  },
});
