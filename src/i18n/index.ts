// Instance i18next partagée par toute l'app — importée depuis app/_layout.tsx
// (point d'init central) pour déclencher `.init()` avant le premier rendu, et
// depuis les modules purs (stats.ts, dateLabels.ts, confirm.ts...) qui ont
// besoin de traduire du texte hors d'un composant React (pas de Hooks
// disponibles là-bas, voir ces fichiers pour le détail).
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(code: string | null | undefined): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(code as SupportedLanguage);
}

// Langue détectée de l'appareil au démarrage (voir Settings.language dans
// settingsStorage.ts : absent = suit cette détection). Repli sur 'fr' si la
// langue de l'appareil n'est pas supportée par l'app.
export function detectDeviceLanguage(): SupportedLanguage {
  const code = Localization.getLocales()[0]?.languageCode;
  return isSupportedLanguage(code) ? code : 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: 'fr',
  interpolation: {
    // React échappe déjà le texte affiché — un double échappement casserait
    // les caractères accentués/apostrophes dans les valeurs interpolées.
    escapeValue: false,
  },
});

export default i18n;
