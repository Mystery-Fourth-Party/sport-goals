import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from '../ui';
import { weekdayShort } from '../../dateLabels';
import { fmt, parseDate } from '../../stats';
import { colors, fontFamily, radius, spacing, white } from '../../theme';
import { Entry, Unit } from '../../types';

interface Props {
  entries: Entry[];
  unit: Unit;
  today: string;
}

// Carte "Dernières séances" (BarChart) — seul usage de ce sous-ensemble
// d'entrées, calcul déplacé ici plutôt que laissé dans l'écran. Rend `null`
// si aucune séance récente : évite au parent de dupliquer la condition
// (recentEntries.length > 0) déjà connue par ce composant.
export default function RecentSessionsCard({ entries, unit, today }: Props) {
  const recentEntries = entries.filter((e) => e.value > 0).slice(-7);
  if (recentEntries.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={[styles.label, styles.cardSectionLabel]}>Dernières séances</Text>
      <BarChart
        bars={recentEntries.map((e) => {
          const d = parseDate(e.date);
          return {
            key: e.date,
            label: weekdayShort(d),
            value: e.value,
            valueLabel: fmt(e.value, unit),
            highlighted: e.date === today,
          };
        })}
      />
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
  cardSectionLabel: {
    marginBottom: 20,
  },
});
