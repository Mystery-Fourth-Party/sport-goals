import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Goal, UNIT_ICONS } from '../types';
import { fmt, getGoalStats, statusLabel, todayStr } from '../stats';
import { colors, fontFamily, radius, spacing, statusColors, white } from '../theme';
import { ProgressBar, StatusBadge } from './ui';

interface Props {
  goal: Goal;
  onPress: () => void;
}

// Carte objectif de l'écran Liste (voir GoalCard dans le prototype) :
// tap → écran Détail. L'ajout de progression et l'édition/suppression
// vivent désormais sur l'écran Détail plutôt qu'inline ici.
export default function GoalCard({ goal, onPress }: Props) {
  const { t } = useTranslation();
  const s = getGoalStats(goal, todayStr());
  const unitLabel = t(`unit.${goal.unit}`);
  // Variante "parlée" de l'unité, réservée aux libellés d'accessibilité :
  // l'abréviation "km" de unit.km est épelée "K M" par TalkBack. unitLabel
  // (compact) reste utilisé pour tout ce qui est affiché à l'écran.
  const unitSpokenLabel = t(`unitSpoken.${goal.unit}`);

  // Phrase complète plutôt que de laisser le lecteur d'écran concaténer les
  // ~7 Text internes dans l'ordre visuel (résultat peu naturel : "45 %"
  // épelé, emoji lus tels quels). Pressable est accessible par défaut en RN
  // (les éléments tactiles le sont) : poser accessibilityLabel dessus suffit
  // à en faire un unique élément focusable pour le lecteur d'écran, qui
  // n'entre alors pas dans les enfants — pas besoin en plus de
  // accessibilityElementsHidden/importantForAccessibility côté enfants ni de
  // accessible={false} dessus (vérifié dans la doc RN sur l'accessibilité).
  const accessibilityParts = [
    goal.title,
    t('goalCard.progressA11y', { percent: Math.round(s.progress * 100) }),
    t('goalCard.remainingDaysA11y', { count: s.remainingDays }),
    statusLabel(s.status),
  ];
  if (s.status === 'late') {
    accessibilityParts.push(
      t('goalCard.lateRequiredA11y', {
        value: fmt(s.dailyRequired, goal.unit),
        unit: unitSpokenLabel,
      }),
    );
  } else if (s.status === 'ahead') {
    accessibilityParts.push(t('goalCard.aheadA11y', { count: s.streak }));
  }

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityParts.join(', ')}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.icon}>
            <Text style={styles.iconGlyph}>{UNIT_ICONS[goal.unit]}</Text>
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.title} numberOfLines={2}>
              {goal.title}
            </Text>
            <Text style={styles.remaining}>
              {t('goalCard.remainingDays', { count: s.remainingDays })}
            </Text>
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
            / {goal.targetValue} {unitLabel}
          </Text>
        </Text>
        <Text style={[styles.percent, { color: statusColors[s.status].text }]}>
          {(s.progress * 100).toFixed(0)}%
        </Text>
      </View>

      {s.status === 'late' && (
        <Text style={styles.lateHint}>
          {t('goalCard.lateHint', { value: fmt(s.dailyRequired, goal.unit), unit: unitLabel })}
        </Text>
      )}
      {s.status === 'ahead' && (
        <Text style={styles.aheadHint}>{t('goalCard.aheadHint', { count: s.streak })}</Text>
      )}
    </Pressable>
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
  // alignItems 'flex-start' plutôt que 'center' : le titre peut occuper
  // 2 lignes (voir numberOfLines ci-dessus), l'icône et le StatusBadge
  // doivent rester calés en haut plutôt que de flotter au milieu.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
});
