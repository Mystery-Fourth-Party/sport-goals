// Libellés de dates écrits à la main (clés dateLabels.* — voir
// src/i18n/locales/*.json) plutôt que via `date.toLocaleDateString(locale,
// ...)` : le support ICU/Intl complet n'est pas garanti sur Hermes (moteur
// JS natif de React Native) selon la configuration de build, contrairement
// au navigateur. Fonctions pures hors composant : lisent directement
// l'instance i18next (pas de Hook disponible ici), comme statusLabel dans
// stats.ts.
import i18n from './i18n';

// { returnObjects: true } fait bien renvoyer le tableau JSON par i18next à
// l'exécution — seul son typage (`$SpecialObject`, opaque) demande ce cast
// explicite.
function weekdayLongList(): string[] {
  return i18n.t('dateLabels.weekdayLong', { returnObjects: true }) as unknown as string[];
}

function weekdayShortList(): string[] {
  return i18n.t('dateLabels.weekdayShort', { returnObjects: true }) as unknown as string[];
}

function monthLongList(): string[] {
  return i18n.t('dateLabels.monthLong', { returnObjects: true }) as unknown as string[];
}

function monthShortList(): string[] {
  return i18n.t('dateLabels.monthShort', { returnObjects: true }) as unknown as string[];
}

export function weekdayLong(d: Date): string {
  return weekdayLongList()[d.getDay()];
}

export function weekdayShort(d: Date): string {
  return weekdayShortList()[d.getDay()];
}

export function monthLong(d: Date): string {
  return monthLongList()[d.getMonth()];
}

export function monthShort(d: Date): string {
  return monthShortList()[d.getMonth()];
}

// "vendredi 20 août" — utilisé pour l'historique de progression.
export function longDateLabel(d: Date): string {
  return `${weekdayLong(d)} ${d.getDate()} ${monthShort(d)}`;
}

// "Mercredi 20 août 2026" — utilisé pour l'en-tête de l'écran Liste.
export function fullDateLabel(d: Date): string {
  const weekday = weekdayLong(d);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()} ${monthLong(d)} ${d.getFullYear()}`;
}

// "14 – 20 août 2026" (ou "29 août – 4 septembre 2026" si la semaine
// chevauche deux mois) — utilisé pour l'en-tête de l'écran Résumé
// hebdomadaire. `start`/`end` sont les deux bornes de la semaine affichée.
export function weekRangeLabel(start: Date, end: Date): string {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${monthLong(end)} ${end.getFullYear()}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startPart = sameYear
    ? `${start.getDate()} ${monthLong(start)}`
    : `${start.getDate()} ${monthLong(start)} ${start.getFullYear()}`;
  return `${startPart} – ${end.getDate()} ${monthLong(end)} ${end.getFullYear()}`;
}
