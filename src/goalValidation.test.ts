import { parseDurationDays } from './goalValidation';

describe('parseDurationDays', () => {
  it('accepts a positive whole number of days', () => {
    expect(parseDurationDays('30')).toBe(30);
    expect(parseDurationDays('1')).toBe(1);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDurationDays('  30  ')).toBe(30);
  });

  it('rejects zero and negative durations', () => {
    expect(parseDurationDays('0')).toBeNull();
    expect(parseDurationDays('-5')).toBeNull();
  });

  // Le vrai trou : `Number(x) > 0` laissait passer 0.5, et
  // Date.setDate() tronque la fraction — la deadline retombait sur le jour
  // de création, d'où une durée nulle (cas C4 du jeu de test, qu'on croyait
  // atteignable seulement par un import).
  it('rejects a fractional duration, which would truncate to a same-day deadline', () => {
    expect(parseDurationDays('0.5')).toBeNull();
    expect(parseDurationDays('1.5')).toBeNull();
  });

  it('rejects anything that is not a number', () => {
    expect(parseDurationDays('')).toBeNull();
    expect(parseDurationDays('   ')).toBeNull();
    expect(parseDurationDays('abc')).toBeNull();
    expect(parseDurationDays('30j')).toBeNull();
    expect(parseDurationDays('Infinity')).toBeNull();
  });
});
