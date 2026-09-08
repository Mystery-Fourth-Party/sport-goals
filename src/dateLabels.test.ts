import {
  fullDateLabel,
  longDateLabel,
  monthLong,
  monthShort,
  weekdayLong,
  weekdayShort,
  weekRangeLabel,
} from './dateLabels';
import i18n from './i18n';

// Ce module lit directement l'instance i18next (pas de Hook hors composant,
// même approche que statusLabel dans stats.ts) : la langue est donc fixée
// explicitement ici, sinon les assertions dépendraient de la langue détectée
// dans l'environnement Jest.
//
// Les chaînes attendues viennent des locales (src/i18n/locales/*.json). Le
// couplage est volontaire : c'est précisément le contrat que ce module
// existe pour tenir, Intl n'étant pas garanti sur Hermes (voir l'en-tête de
// dateLabels.ts). Renommer un mois dans les locales doit casser ces tests.
beforeEach(() => i18n.changeLanguage('fr'));

// Jeudi 20 août 2026. Construites en heure locale (comme parseDate dans
// stats.ts) : ce module ne lit que getDay/getDate/getMonth/getFullYear, donc
// aucune conversion UTC ne doit s'intercaler.
const jeudi20Aout = new Date(2026, 7, 20);
const dimanche1erMars = new Date(2026, 2, 1);

describe('weekdayLong / weekdayShort', () => {
  it('reads the weekday from the current locale', () => {
    expect(weekdayLong(jeudi20Aout)).toBe('jeudi');
    expect(weekdayShort(jeudi20Aout)).toBe('jeu');
  });

  it('maps getDay() === 0 to the first entry of the list, not the last', () => {
    expect(dimanche1erMars.getDay()).toBe(0);
    expect(weekdayLong(dimanche1erMars)).toBe('dimanche');
    expect(weekdayShort(dimanche1erMars)).toBe('dim');
  });

  it('follows a language change', async () => {
    await i18n.changeLanguage('en');
    expect(weekdayLong(jeudi20Aout)).toBe('Thursday');
    expect(weekdayShort(jeudi20Aout)).toBe('Thu');
  });
});

describe('monthLong / monthShort', () => {
  it('reads the month from the current locale', () => {
    expect(monthLong(jeudi20Aout)).toBe('août');
    expect(monthShort(jeudi20Aout)).toBe('août');
  });

  it('maps getMonth() === 0 to January, not December', () => {
    const janvier = new Date(2026, 0, 15);
    expect(monthLong(janvier)).toBe('janvier');
    expect(monthShort(janvier)).toBe('janv.');
  });

  it('follows a language change', async () => {
    await i18n.changeLanguage('en');
    expect(monthLong(jeudi20Aout)).toBe('August');
    expect(monthShort(jeudi20Aout)).toBe('Aug');
  });
});

describe('longDateLabel', () => {
  it('combines weekday, day number and short month', () => {
    expect(longDateLabel(jeudi20Aout)).toBe('jeudi 20 août');
  });

  it('follows a language change', async () => {
    await i18n.changeLanguage('en');
    expect(longDateLabel(jeudi20Aout)).toBe('Thursday 20 Aug');
  });
});

describe('fullDateLabel', () => {
  it('capitalises the weekday and spells the month out in full', () => {
    expect(fullDateLabel(jeudi20Aout)).toBe('Jeudi 20 août 2026');
  });

  // La capitalisation porte sur le premier caractère seulement : en anglais
  // le libellé est déjà capitalisé dans la locale, la fonction ne doit pas
  // le dégrader.
  it('leaves an already-capitalised weekday untouched', async () => {
    await i18n.changeLanguage('en');
    expect(fullDateLabel(jeudi20Aout)).toBe('Thursday 20 August 2026');
  });
});

describe('weekRangeLabel', () => {
  it('names the month once when both ends share it', () => {
    expect(weekRangeLabel(new Date(2026, 7, 14), new Date(2026, 7, 20))).toBe('14 – 20 août 2026');
  });

  it('names both months when the week straddles two of them in the same year', () => {
    expect(weekRangeLabel(new Date(2026, 7, 29), new Date(2026, 8, 4))).toBe(
      '29 août – 4 septembre 2026',
    );
  });

  it('repeats the year on the start date when the week straddles two years', () => {
    expect(weekRangeLabel(new Date(2026, 11, 28), new Date(2027, 0, 3))).toBe(
      '28 décembre 2026 – 3 janvier 2027',
    );
  });

  // Même mois mais années différentes : le test décide si la comparaison
  // porte bien sur (mois, année) et pas sur le mois seul.
  it('does not treat the same month of two different years as one month', () => {
    expect(weekRangeLabel(new Date(2025, 7, 20), new Date(2026, 7, 20))).toBe(
      '20 août 2025 – 20 août 2026',
    );
  });

  it('follows a language change', async () => {
    await i18n.changeLanguage('en');
    expect(weekRangeLabel(new Date(2026, 7, 14), new Date(2026, 7, 20))).toBe(
      '14 – 20 August 2026',
    );
  });
});
