import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { longDateLabel } from '../../dateLabels';
import { fmt, parseDate } from '../../stats';
import { colors, fontFamily, radius, spacing, white } from '../../theme';
import { Entry, Unit } from '../../types';

interface Props {
  entries: Entry[];
  unit: Unit;
  today: string;
  onEntryPress: (entry: Entry) => void;
}

// Carte "Historique" — calcul de historyEntries (reverse + slice(0, 12)) et
// construction de l'accessibilityLabel composite par ligne déplacés ici,
// c'était leur seul usage.
export default function GoalHistoryList({ entries, unit, today, onEntryPress }: Props) {
  const { t } = useTranslation();
  const unitLabel = t(`unit.${unit}`);
  // Variante "parlée" de l'unité pour l'accessibilityLabel des lignes :
  // TalkBack épelle "K M" sur l'abréviation "km" de unit.km. unitLabel
  // (compact) reste utilisé pour la valeur affichée à droite de la ligne.
  const unitSpokenLabel = t(`unitSpoken.${unit}`);
  const historyEntries = [...entries].reverse().slice(0, 12);

  return (
    <View style={[styles.card, styles.historyCard]}>
      <Text style={[styles.label, styles.historyHeader]}>{t('goalDetail.history.title')}</Text>
      {historyEntries.map((entry, i) => {
        const d = parseDate(entry.date);
        const isToday = entry.date === today;
        const entryAccessibilityLabel =
          entry.value > 0
            ? `${longDateLabel(d)}, ${fmt(entry.value, unit)} ${unitSpokenLabel}`
            : `${longDateLabel(d)}, ${t('goalDetail.history.noEntry')}`;
        return (
          <Pressable
            key={entry.date}
            onPress={() => onEntryPress(entry)}
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
                {isToday && (
                  <Text style={styles.historyToday}> {t('goalDetail.history.today')}</Text>
                )}
              </Text>
            </View>
            <Text style={styles.historyValue}>
              {entry.value > 0 ? `${fmt(entry.value, unit)} ${unitLabel}` : '—'}
            </Text>
          </Pressable>
        );
      })}
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
});
