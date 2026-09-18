import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, white } from '../../theme';

export interface BarChartBar {
  key: string;
  label: string;
  value: number;
  valueLabel?: string;
  highlighted?: boolean;
}

interface Props {
  bars: BarChartBar[];
  height?: number;
  // Affiche la valeur au-dessus de chaque barre, même à 0 (utile pour
  // "Dernières séances" — évité pour "Séances par jour" où 0 n'apporte rien).
  showZeroValueLabel?: boolean;
  // Quand il est fourni, tout le graphique devient un seul élément
  // accessible portant ce libellé, au lieu d'être parcouru colonne par
  // colonne — motif retenu partout dans ce dépôt après tests terrain
  // (GoalCard, cartes En cours/Total de app/index.tsx, GoalFields) : un
  // arrêt de navigation par unité de sens, pas un par fragment.
  //
  // Optionnel et non obligatoire parce que les deux appelants n'ont pas le
  // même besoin. RecentSessionsCard (écran Détail) masque au contraire tout
  // son graphique au lecteur d'écran, le contenu étant déjà donné par la
  // liste d'historique juste en dessous — arbitrage pris au test du 02/09,
  // que ce composant ne doit pas défaire. Le libellé vient de l'appelant
  // parce que lui seul sait ce que les barres signifient : « 3 séances »
  // ici, « 5 km » là.
  accessibilityLabel?: string;
}

// Mini graphique en barres partagé par l'écran Détail ("Dernières séances")
// et l'écran Résumé hebdomadaire ("Séances par jour") — voir design-tokens.md.
export default function BarChart({
  bars,
  height = 64,
  showZeroValueLabel = true,
  accessibilityLabel,
}: Props) {
  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  return (
    <View
      style={[styles.row, { height: height + 32 }]}
      accessible={accessibilityLabel !== undefined}
      // Pas de rôle dédié au graphique dans React Native : "image" est le
      // plus proche, avec le libellé qui joue le rôle d'alternative
      // textuelle.
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {bars.map((b) => {
        const heightPct = (b.value / maxValue) * 100;
        return (
          <View key={b.key} style={styles.column}>
            {(b.value > 0 || showZeroValueLabel) && (
              <Text style={styles.valueLabel}>{b.valueLabel ?? String(b.value)}</Text>
            )}
            <View style={[styles.barTrack, { height }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(heightPct, b.value > 0 ? 4 : 2)}%`,
                    backgroundColor: b.highlighted ? colors.brand : white(0.15),
                  },
                ]}
              />
            </View>
            <Text style={[styles.dayLabel, b.highlighted && styles.dayLabelHighlighted]}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  valueLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 9,
    color: white(0.4),
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  dayLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 9,
    color: white(0.25),
    textTransform: 'capitalize',
  },
  dayLabelHighlighted: {
    color: colors.brand,
    fontFamily: fontFamily.bodySemiBold,
  },
});
