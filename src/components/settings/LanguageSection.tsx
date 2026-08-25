import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../../settings-context';
import { colors, fontFamily } from '../../theme';
import { settingsStyles as s } from './styles';

interface LanguageOption {
  // undefined ('system') = pas de valeur stockée, suit la langue détectée
  // de l'appareil (voir settingsStorage.ts, src/i18n/index.ts).
  value: 'fr' | 'en' | undefined;
  labelKey: string;
}

const OPTIONS: LanguageOption[] = [
  { value: 'fr', labelKey: 'languageSection.french' },
  { value: 'en', labelKey: 'languageSection.english' },
  { value: undefined, labelKey: 'languageSection.system' },
];

// 3 choix (Français/English/Système), même esprit visuel (carte + lignes)
// que NotificationsSection/DataSection. "Français"/"English" ne sont pas
// traduits via t() : le nom d'une langue s'affiche conventionnellement dans
// cette langue elle-même, pas dans la langue courante de l'app.
export default function LanguageSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();

  return (
    <>
      <Text style={[s.sectionLabel, s.sectionLabelSpaced]}>{t('languageSection.title')}</Text>
      <View style={s.card}>
        {OPTIONS.map((option, i) => {
          const selected = settings.language === option.value;
          return (
            <Pressable
              key={option.labelKey}
              style={[s.row, i < OPTIONS.length - 1 && s.rowBorder]}
              onPress={() => updateSettings({ language: option.value })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={s.rowTitlePlain}>{t(option.labelKey)}</Text>
              {selected && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  check: {
    color: colors.brand,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
  },
});
