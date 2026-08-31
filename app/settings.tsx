import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../src/components/ui';
import { DataSection, LanguageSection, NotificationsSection } from '../src/components/settings';
import { settingsStyles } from '../src/components/settings/styles';
import { colors, fontFamily, spacing, white } from '../src/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      {/* ScrollView et pas une View : le contenu (4 sections + watermark)
          dépasse un écran de téléphone, et tout ce qui débordait — dont les
          options English/Système du sélecteur de langue — était à la fois
          invisible et injoignable, y compris au geste de scroll de
          TalkBack. Même pattern que app/goal/[id].tsx. */}
      <ScrollView contentContainerStyle={styles.content}>
        <NotificationsSection />
        <DataSection />
        <LanguageSection />

        <Text style={[settingsStyles.sectionLabel, settingsStyles.sectionLabelSpaced]}>
          {t('settings.appSection')}
        </Text>
        <View style={settingsStyles.card}>
          <View style={[settingsStyles.row, settingsStyles.rowBorder]}>
            <Text style={settingsStyles.rowTitlePlain}>{t('settings.version')}</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
          <View style={settingsStyles.row}>
            <Text style={settingsStyles.rowTitle}>{t('settings.appName')}</Text>
            <Text style={styles.betaValue}>{t('settings.beta')}</Text>
          </View>
        </View>

        <Text style={styles.watermark}>{t('settings.watermark')}</Text>
      </ScrollView>
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
    paddingBottom: 40,
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
