import { parseDurationDays, parsePositiveNumber } from './goalValidation';

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

describe('parsePositiveNumber', () => {
  it('accepts a positive number, whole or fractional', () => {
    expect(parsePositiveNumber('100')).toBe(100);
    expect(parsePositiveNumber('2.5')).toBe(2.5);
  });

  it('rejects zero, negatives and empty input', () => {
    expect(parsePositiveNumber('0')).toBeNull();
    expect(parsePositiveNumber('-5')).toBeNull();
    expect(parsePositiveNumber('')).toBeNull();
    expect(parsePositiveNumber('abc')).toBeNull();
  });

  // Le trou de R2 : `Number(x) > 0` laissait passer ces trois saisies.
  it('rejects values that overflow to Infinity', () => {
    expect(parsePositiveNumber('1e400')).toBeNull();
    expect(parsePositiveNumber('Infinity')).toBeNull();
    expect(parsePositiveNumber('1e309')).toBeNull();
  });

  it('keeps the largest finite values, which JSON can still write', () => {
    expect(parsePositiveNumber('1e308')).toBe(1e308);
  });
});
