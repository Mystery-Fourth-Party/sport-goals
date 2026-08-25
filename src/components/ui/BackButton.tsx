import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { size, white } from '../../theme';

interface Props {
  onPress: () => void;
}

// Bouton rond flèche retour. Le prototype utilise une icône SVG custom ;
// on utilise ici un glyphe texte pour rester sans dépendance supplémentaire
// (react-native-svg / @expo/vector-icons) à ce stade — à revoir si un vrai
// jeu d'icônes est introduit plus tard.
export default function BackButton({ onPress }: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
    >
      <Text style={styles.glyph}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: size.roundIconButton,
    height: size.roundIconButton,
    borderRadius: size.roundIconButton / 2,
    backgroundColor: white(0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginRight: 2,
    marginTop: -2,
  },
});
