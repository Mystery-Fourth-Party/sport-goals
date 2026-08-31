import { StyleSheet, View } from 'react-native';
import { Status } from '../../stats';
import { radius, statusColors, white } from '../../theme';

interface Props {
  // Ratio de progression (0..1). Les valeurs hors bornes sont clampées à
  // l'affichage : un objectif dépassé (>1) ne casse pas la barre.
  value: number;
  status: Status;
  thick?: boolean;
}

// Barre de progression fine (liste) ou épaisse (écran Détail), couleur
// selon statut (voir statusColors dans theme.ts).
export default function ProgressBar({ value, status, thick }: Props) {
  const palette = statusColors[status];
  const clampedValue = Math.min(Math.max(value, 0), 1);
  const widthPct = `${clampedValue * 100}%` as const;

  return (
    <View
      style={[styles.track, thick ? styles.trackThick : styles.trackThin]}
      accessibilityRole="progressbar"
      // Pas de accessibilityLabel ici : le pourcentage est déjà affiché en
      // texte séparé à chaque endroit où ProgressBar est utilisé (GoalCard,
      // goal/[id].tsx, weekly.tsx) — le rôle progressbar suffit à donner du
      // sens à cet élément.
      // `text` en plus de min/max/now : sans lui, TalkBack annonce le
      // nombre brut ("15") sans son unité — avec, il lit "15 %".
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clampedValue * 100),
        text: `${Math.round(clampedValue * 100)}%`,
      }}
    >
      <View style={[styles.fill, { width: widthPct, backgroundColor: palette.bar }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: white(0.1),
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  trackThin: {
    height: 6,
  },
  trackThick: {
    height: 8,
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
