// Design system partagé, porté depuis design-reference/design-tokens.md
// (extrait de src/index.css du prototype Figma Make). Le prototype est en
// Tailwind/web ; ici, valeurs concrètes pour StyleSheet React Native.
import { useFonts } from 'expo-font';
import {
  BarlowCondensed_400Regular,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { Status } from './stats';

// ─── Couleurs ─────────────────────────────────────────────────────────────
// Valeurs telles que listées dans design-tokens.md (--color-*). Note : la
// barre de progression du statut "dans les temps" utilise l'orange de marque
// (`brand`), pas le bleu du badge — voir la table "Statuts → couleurs".

export const colors = {
  appBg: '#0E0E12',
  card: '#1C1C22',
  cardElevated: '#242430',
  border: 'rgba(255,255,255,0.06)',
  fg: '#F5F5F7',
  muted: '#6B6B7E',
  brand: '#FF6B00',
  brandGlow: 'rgba(255,107,0,0.25)',
  ahead: '#22C55E',
  onTrackBadge: '#3B82F6',
  late: '#EF4444',
  almostThere: '#F59E0B',
} as const;

// Opacités blanches fréquentes dans le prototype (white/[0.06] à white/60+).
// Un seul hex source (#FFFFFF) + alpha, plutôt que deviner des teintes
// intermédiaires non documentées.
export function white(alpha: number): string {
  return `rgba(255,255,255,${alpha})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Statuts → couleurs ─────────────────────────────────────────────────
// Le prototype distingue des teintes -400 (texte) / -500 (fond) par statut
// Tailwind ; design-tokens.md ne donne qu'une valeur par statut, donc on la
// réutilise pour badge/texte/barre plutôt que d'inventer des tons non
// vérifiés — seule la barre "dans les temps" dévie (orange de marque).
export interface StatusPalette {
  badgeBg: string;
  badgeText: string;
  bar: string;
  text: string;
}

export const statusColors: Record<Status, StatusPalette> = {
  ahead: {
    badgeBg: withAlpha(colors.ahead, 0.15),
    badgeText: colors.ahead,
    bar: colors.ahead,
    text: colors.ahead,
  },
  'on-track': {
    badgeBg: withAlpha(colors.onTrackBadge, 0.15),
    badgeText: colors.onTrackBadge,
    bar: colors.brand,
    text: colors.brand,
  },
  late: {
    badgeBg: withAlpha(colors.late, 0.15),
    badgeText: colors.late,
    bar: colors.late,
    text: colors.late,
  },
  completed: {
    badgeBg: withAlpha(colors.ahead, 0.15),
    badgeText: colors.ahead,
    bar: colors.ahead,
    text: colors.ahead,
  },
  'not-started': {
    badgeBg: white(0.1),
    badgeText: white(0.4),
    bar: white(0.2),
    text: white(0.4),
  },
};

// ─── Typographie ──────────────────────────────────────────────────────────
// Titres/display : Barlow Condensed (uppercase, tracking-wide dans le
// prototype — à appliquer via style, RN ne le fait pas automatiquement).
// Corps : Outfit. Noms de familles = noms d'export @expo-google-fonts,
// à utiliser tels quels comme `fontFamily` une fois chargés (voir useAppFonts).

export const fontFamily = {
  displayRegular: 'BarlowCondensed_400Regular',
  displayBold: 'BarlowCondensed_700Bold',
  displayExtraBold: 'BarlowCondensed_800ExtraBold',
  displayBlack: 'BarlowCondensed_900Black',
  bodyLight: 'Outfit_300Light',
  bodyRegular: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemiBold: 'Outfit_600SemiBold',
  bodyBold: 'Outfit_700Bold',
} as const;

// Charge les polices Google Fonts nécessaires au design system. Ce hook
// n'est pas encore appelé depuis App.tsx (hors scope de cette étape) ;
// l'appelant doit gérer l'état de chargement (ex: ne rien rendre / garder
// le splash screen tant que `fontsLoaded` est false), voir la doc Expo
// SDK 57 sur expo-font pour le pattern recommandé.
export function useAppFonts() {
  return useFonts({
    BarlowCondensed_400Regular,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_900Black,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
}

// ─── Rayons / tailles / espacements récurrents ───────────────────────────

export const radius = {
  card: 16,
  button: 12,
  pill: 9999,
} as const;

export const size = {
  fab: 56,
  roundIconButton: 40,
} as const;

export const spacing = {
  screenPadding: 20,
  cardPadding: 18,
  gap: 12,
} as const;
