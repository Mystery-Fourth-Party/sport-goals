import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GoalsProvider } from '../src/goals-context';
import ReminderScheduler from '../src/ReminderScheduler';
import { SettingsProvider } from '../src/settings-context';
import { colors, useAppFonts } from '../src/theme';

// Empêche le splash natif de se cacher tout seul le temps que les polices
// (Barlow Condensed/Outfit) soient chargées — évite un flash avec les
// polices système. Doit être appelé au niveau module, avant le rendu.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SettingsProvider>
      <GoalsProvider>
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
      </GoalsProvider>
    </SettingsProvider>
  );
}
