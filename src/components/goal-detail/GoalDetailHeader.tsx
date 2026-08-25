import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton, StatusBadge } from '../ui';
import { fmt, GoalStats } from '../../stats';
import { colors, fontFamily, radius, spacing, white } from '../../theme';
import { Goal, UNIT_ICONS } from '../../types';

interface Props {
  goal: Goal;
  stats: GoalStats;
  remaining: number;
  showAlmostThere: boolean;
  onBack: () => void;
  onEdit: () => void;
}

// Bouton retour, titre + méta (jour X/Y, jours restants), bouton édition,
// StatusBadge, et les 3 bannières conditionnelles (retard/avance/presque
// là). Callbacks reçus du parent plutôt qu'import direct de router — même
// logique que GoalCard, qui reçoit onPress de son parent.
export default function GoalDetailHeader({
  goal,
  stats: s,
  remaining,
  showAlmostThere,
  onBack,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const unitLabel = t(`unit.${goal.unit}`);

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <BackButton onPress={onBack} />
        <View style={styles.headerTexts}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerIcon}>{UNIT_ICONS[goal.unit]}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {goal.title}
            </Text>
          </View>
          <Text style={styles.headerMeta}>
            {t('goalDetail.header.meta', {
              elapsedDays: s.elapsedDays,
              totalDays: s.totalDays,
              remainingDays: t('goalCard.remainingDays', { count: s.remainingDays }),
            })}
          </Text>
        </View>
        <Pressable
          style={styles.editButton}
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('goalDetail.header.editA11y')}
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
              {t('goalDetail.header.lateBannerTitle')}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {t('goalDetail.header.lateBannerSubtitle', {
                value: fmt(s.dailyRequired, goal.unit),
                unit: unitLabel,
              })}
            </Text>
          </View>
        </View>
      )}
      {s.status === 'ahead' && !showAlmostThere && (
        <View style={[styles.banner, styles.bannerAhead]}>
          <Text style={styles.bannerEmoji}>🔥</Text>
          <View style={styles.bannerTexts}>
            <Text style={[styles.bannerTitle, { color: colors.ahead }]}>
              {t('goalDetail.header.aheadBannerTitle')}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {t('goalDetail.header.aheadBannerSubtitle', {
                value: fmt(remaining, goal.unit),
                unit: unitLabel,
              })}
            </Text>
          </View>
        </View>
      )}
      {showAlmostThere && (
        <View style={[styles.banner, styles.bannerAlmost]}>
          <Text style={styles.bannerEmoji}>🎯</Text>
          <View style={styles.bannerTexts}>
            <Text style={[styles.bannerTitle, { color: colors.almostThere }]}>
              {t('goalDetail.header.almostBannerTitle')}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {t('goalDetail.header.almostBannerSubtitle', {
                value: fmt(remaining, goal.unit),
                unit: unitLabel,
              })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
