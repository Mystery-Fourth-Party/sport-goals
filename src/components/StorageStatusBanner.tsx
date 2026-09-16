// Bandeau d'alerte sur les échecs de persistance, rendu au-dessus du Stack
// dans app/_layout.tsx pour être visible depuis n'importe quel écran : une
// écriture peut échouer sur l'écran Détail (ajout de progression), Créer,
// Édition ou Réglages (import d'une sauvegarde), pas seulement là où l'on
// pourrait aller lire un statut. C'est le pendant visible du contexte
// storage-status.tsx, qui n'affiche rien par lui-même.
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStorageStatus } from '../storage-status';
import { colors, fontFamily, spacing, white } from '../theme';

export default function StorageStatusBanner() {
  const { t } = useTranslation();
  const { loadFailed, saveFailed } = useStorageStatus();
  const insets = useSafeAreaInsets();

  // L'échec de lecture prime sur l'échec d'écriture : tant qu'il dure, les
  // providers n'écrivent plus rien du tout (voir goals-context.tsx), donc
  // « ta dernière modification n'a pas pu être enregistrée » serait à la
  // fois redondant et moins actionnable que « ferme et rouvre l'app ».
  const message = loadFailed
    ? t('storage.loadFailed')
    : saveFailed
      ? t('storage.saveFailed')
      : undefined;

  if (!message) return null;

  return (
    <View
      // Le bandeau est le premier élément de l'écran : il porte lui-même
      // l'encoche/la barre de statut, les écrans en dessous gardant leur
      // propre SafeAreaView.
      style={[styles.banner, { paddingTop: insets.top + 12 }]}
      // accessible : sans lui, le View n'est pas un élément à part entière
      // pour le lecteur d'écran, qui descendrait dans le Text et perdrait le
      // rôle d'alerte posé juste en dessous.
      accessible
      // role="alert" + live region : le message apparaît sans action de
      // l'utilisateur, un lecteur d'écran doit l'annoncer sans attendre que
      // le focus arrive dessus. accessibilityLiveRegion n'a d'effet que sur
      // Android ; accessibilityRole="alert" couvre iOS.
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.late,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 12,
  },
  text: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: white(0.95),
  },
});
