import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../ui';
import { fmt, GoalStats } from '../../stats';
import { colors, fontFamily, radius, spacing, statusColors, white } from '../../theme';
import { Goal } from '../../types';

interface Props {
  goal: Goal;
  stats: GoalStats;
}

// Carte "Progression totale" : valeur/cible, %, attendu, ProgressBar,
// streak/rythme/requis.
export default function GoalProgressCard({ goal, stats: s }: Props) {
  const { t } = useTranslation();
  const unitLabel = t(`unit.${goal.unit}`);

  return (
    <View style={styles.card}>
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.label}>Progression totale</Text>
          <Text style={styles.progressValue}>
            {fmt(s.actual, goal.unit)}
            <Text style={styles.progressValueMuted}>
              {' '}
              / {goal.targetValue} {unitLabel}
            </Text>
          </Text>
        </View>
        <View style={styles.progressPercentBlock}>
          <Text style={[styles.progressPercent, { color: statusColors[s.status].text }]}>
            {(s.progress * 100).toFixed(0)}%
          </Text>
          <Text style={styles.expectedLabel}>Attendu {(s.expectedProgress * 100).toFixed(0)}%</Text>
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
  );
}

const styles = StyleSheet.create({
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
});
