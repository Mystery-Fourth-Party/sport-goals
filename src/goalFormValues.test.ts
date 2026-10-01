// Couvre goalToFormValues : les valeurs de départ du formulaire de création
// tirées d'un objectif existant (durée d'origine, rappel, défauts absents).
import { goalToFormValues } from './goalFormValues';
import { Goal } from './types';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Courir 100 km',
    targetValue: 100,
    unit: 'km',
    createdAt: '2026-07-01T12:00:00.000Z',
    deadline: '2026-07-31T12:00:00.000Z',
    entries: [{ date: '2026-07-10', value: 30 }],
    reminderEnabled: false,
    reminderTime: '07:30',
    remindAfterReached: true,
    ...overrides,
  };
}

describe('goalToFormValues', () => {
  it('reprend titre, cible, unité et réglages de rappel', () => {
    expect(goalToFormValues(makeGoal(), '2026-09-30')).toEqual({
      title: 'Courir 100 km',
      targetValue: '100',
      unit: 'km',
      durationDays: '30',
      reminderEnabled: false,
      reminderTime: '07:30',
      remindAfterReached: true,
    });
  });

  it('donne la même durée quel que soit le jour où on la lit', () => {
    const goal = makeGoal();

    expect(goalToFormValues(goal, '2026-07-15').durationDays).toBe('30');
    expect(goalToFormValues(goal, '2026-12-01').durationDays).toBe('30');
  });

  it('applique les défauts d un objectif sans réglage de rappel', () => {
    const goal = makeGoal({
      reminderEnabled: undefined,
      reminderTime: undefined,
      remindAfterReached: undefined,
    });

    const values = goalToFormValues(goal, '2026-09-30');

    expect(values.reminderEnabled).toBe(true);
    expect(values.reminderTime).toBeUndefined();
    expect(values.remindAfterReached).toBe(false);
  });

  it('plancher la durée à 1 jour', () => {
    const goal = makeGoal({ createdAt: '2026-07-31T12:00:00.000Z' });

    expect(goalToFormValues(goal, '2026-09-30').durationDays).toBe('1');
  });

  it('ne plafonne pas une durée au-delà de la limite', () => {
    const goal = makeGoal({
      createdAt: '2025-01-01T12:00:00.000Z',
      deadline: '2026-02-05T12:00:00.000Z',
    });

    expect(goalToFormValues(goal, '2026-09-30').durationDays).toBe('400');
  });
});
