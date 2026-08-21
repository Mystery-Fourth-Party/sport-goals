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
