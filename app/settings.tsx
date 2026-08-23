import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../src/components/ui';
import { DataSection, NotificationsSection } from '../src/components/settings';
import { settingsStyles } from '../src/components/settings/styles';
import { colors, fontFamily, spacing, white } from '../src/theme';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <View style={styles.content}>
        <NotificationsSection />
        <DataSection />

        <Text style={[settingsStyles.sectionLabel, settingsStyles.sectionLabelSpaced]}>
          Application
        </Text>
        <View style={settingsStyles.card}>
          <View style={[settingsStyles.row, settingsStyles.rowBorder]}>
            <Text style={settingsStyles.rowTitlePlain}>Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
          <View style={settingsStyles.row}>
            <Text style={settingsStyles.rowTitle}>Objectif-sport</Text>
            <Text style={styles.betaValue}>Bêta</Text>
          </View>
        </View>

        <Text style={styles.watermark}>NO PAIN{'\n'}NO GAIN</Text>
      </View>
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
  content: {
    paddingHorizontal: spacing.screenPadding,
  },
  versionValue: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: white(0.35),
  },
  betaValue: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.brand,
  },
  watermark: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 32,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: white(0.04),
    textAlign: 'center',
    marginTop: 32,
  },
});
