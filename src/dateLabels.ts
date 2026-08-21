// Libellés de dates en français écrits à la main plutôt que via
// `date.toLocaleDateString('fr-FR', ...)` : le support ICU/Intl complet
// (locale fr-FR) n'est pas garanti sur Hermes (moteur JS natif de React
// Native) selon la configuration de build, contrairement au navigateur.
const WEEKDAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const WEEKDAY_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MONTH_LONG = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const MONTH_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function weekdayLong(d: Date): string {
  return WEEKDAY_LONG[d.getDay()];
}

export function weekdayShort(d: Date): string {
  return WEEKDAY_SHORT[d.getDay()];
}

export function monthLong(d: Date): string {
  return MONTH_LONG[d.getMonth()];
}

export function monthShort(d: Date): string {
  return MONTH_SHORT[d.getMonth()];
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
