import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../src/components/ui';
import { colors, fontFamily, spacing, white } from '../src/theme';

// Stub temporaire : juste de quoi faire exister la route /settings (requis
// par expo-router avec typedRoutes activé, sinon router.push('/settings')
// dans app/index.tsx ne type-check pas). Contenu réel (toggles
// notifications, version) prévu à l'étape suivante.
export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Paramètres</Text>
      </View>
      <Text style={styles.placeholder}>Réglages à venir.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 20,
  },
  title: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 22,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.fg,
  },
  placeholder: {
    fontFamily: fontFamily.bodyRegular,
    color: white(0.4),
    textAlign: 'center',
    marginTop: 40,
  },
});
