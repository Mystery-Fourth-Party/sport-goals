import { StyleSheet, Text, View } from 'react-native';
import { Status, statusLabel } from '../../stats';
import { fontFamily, radius, statusColors } from '../../theme';

interface Props {
  status: Status;
}

// Pill de statut coloré (voir design-tokens.md § Statuts → couleurs).
export default function StatusBadge({ status }: Props) {
  const palette = statusColors[status];
  return (
    <View style={[styles.container, { backgroundColor: palette.badgeBg }]}>
      <Text style={[styles.text, { color: palette.badgeText }]}>
        {statusLabel(status).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
});
