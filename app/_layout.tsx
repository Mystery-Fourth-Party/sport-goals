import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { GoalsProvider } from '../src/goals-context';
import i18n, { detectDeviceLanguage } from '../src/i18n';
import { ReminderStatusProvider } from '../src/reminder-status';
import ReminderScheduler from '../src/ReminderScheduler';
import { SettingsProvider, useSettings } from '../src/settings-context';
import { colors, useAppFonts } from '../src/theme';

// Empêche le splash natif de se cacher tout seul le temps que les polices
// (Barlow Condensed/Outfit) soient chargées — évite un flash avec les
// polices système. Doit être appelé au niveau module, avant le rendu.
SplashScreen.preventAutoHideAsync();

// Applique settings.language (voir settingsStorage.ts) une fois les réglages
// chargés, et réagit à un changement en cours de session (sélecteur de
// Réglages) — absent = suit la langue détectée de l'appareil. Composant
// invisible séparé plutôt qu'un effet dans RootLayout : a besoin de
// useSettings, disponible seulement à l'intérieur de SettingsProvider.
function LanguageSync() {
  const { settings, loaded } = useSettings();

  useEffect(() => {
    if (!loaded) return;
    i18n.changeLanguage(settings.language ?? detectDeviceLanguage());
  }, [settings.language, loaded]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  // Pas d'usage direct de `t` ici : ce Hook abonne RootLayout (et donc tout
  // son arbre, aucun composant enfant n'étant mémoïsé) aux changements de
  // langue — un changement de settings.language (voir LanguageSync)
  // déclenche un nouveau rendu de toute l'app, y compris le texte produit
  // par des fonctions pures hors composants (statusLabel, dateLabels...) qui
  // ne s'abonnent pas elles-mêmes.
  useTranslation();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SettingsProvider>
      <GoalsProvider>
        <ReminderStatusProvider>
          <LanguageSync />
          <ReminderScheduler />
          {/* headerShown: false — chaque écran dessine son propre en-tête
              (BackButton + titre Barlow Condensed), comme dans le prototype. */}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.appBg },
              animation: 'slide_from_right',
            }}
          />
          <StatusBar style="light" />
        </ReminderStatusProvider>
      </GoalsProvider>
    </SettingsProvider>
  );
}
