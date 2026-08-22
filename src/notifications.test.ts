import {
  buildReminderContent,
  computeNextReminderDate,
  ongoingGoalsWithoutTodayEntry,
  parseReminderTime,
} from './notifications';
import { Goal } from './types';

function makeGoal(overrides: Partial<Goal> & Pick<Goal, 'id' | 'entries'>): Goal {
  return {
    title: 'Goal',
    targetValue: 100,
    unit: 'reps',
    createdAt: '2026-08-01T00:00:00.000Z',
    deadline: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('parseReminderTime', () => {
  it.each(['20:00', '9:05', '09:05', '23:59', '0:00'])('accepts %s', (time) => {
    expect(parseReminderTime(time)).not.toBeNull();
  });

  it.each(['24:00', '9:60', 'abc', '', '9-00', '20:0', '1200'])('rejects %s', (time) => {
    expect(parseReminderTime(time)).toBeNull();
  });

  it('extracts the correct hour/minute', () => {
    expect(parseReminderTime('20:05')).toEqual({ hour: 20, minute: 5 });
  });
});

describe('computeNextReminderDate', () => {
  it('targets today when the time has not passed yet', () => {
    const now = new Date(2026, 7, 21, 14, 0, 0); // 21 août 2026, 14:00
    const result = computeNextReminderDate(now, 20, 0);
    expect(result).toEqual(new Date(2026, 7, 21, 20, 0, 0));
  });

  it('rolls over to tomorrow when the time has already passed today', () => {
    const now = new Date(2026, 7, 21, 21, 0, 0); // 21:00, past the 20:00 target
    const result = computeNextReminderDate(now, 20, 0);
    expect(result).toEqual(new Date(2026, 7, 22, 20, 0, 0));
  });

  it('rolls over to tomorrow when now is exactly the target time', () => {
    const now = new Date(2026, 7, 21, 20, 0, 0);
    const result = computeNextReminderDate(now, 20, 0);
    expect(result).toEqual(new Date(2026, 7, 22, 20, 0, 0));
  });
});

describe('ongoingGoalsWithoutTodayEntry', () => {
  const today = '2026-08-21';

  it('excludes goals already progressed today', () => {
    const logged = makeGoal({ id: '1', entries: [{ date: today, value: 5 }] });
    const pending = makeGoal({ id: '2', entries: [] });
    expect(ongoingGoalsWithoutTodayEntry([logged, pending], today)).toEqual([pending]);
  });

  it('excludes completed goals even without a today entry', () => {
    const completed = makeGoal({
      id: '1',
      targetValue: 10,
      entries: [{ date: '2026-08-01', value: 10 }],
    });
    expect(ongoingGoalsWithoutTodayEntry([completed], today)).toEqual([]);
  });

  it('ignores a zero-value entry (not real progress)', () => {
    const zeroToday = makeGoal({ id: '1', entries: [{ date: today, value: 0 }] });
    expect(ongoingGoalsWithoutTodayEntry([zeroToday], today)).toEqual([zeroToday]);
  });
});

describe('buildReminderContent', () => {
  const today = '2026-08-21';
  const pending = [makeGoal({ id: '1', title: 'Pompes', entries: [] })];

  it('returns the generic message when streak alerts are disabled', () => {
    const content = buildReminderContent(pending, today, false);
    expect(content.body).toMatch(/pas encore ajouté/);
  });

  it('returns the generic message when no goal has an active streak', () => {
    const content = buildReminderContent(pending, today, true);
    expect(content.body).toMatch(/pas encore ajouté/);
  });

  it('returns the streak message for a goal with a streak ending yesterday', () => {
    const withStreak = makeGoal({
      id: '1',
      title: 'Pompes',
      entries: [
        { date: '2026-08-19', value: 10 },
        { date: '2026-08-20', value: 10 },
      ],
    });
    const content = buildReminderContent([withStreak], today, true);
    expect(content.body).toContain('Pompes');
    expect(content.body).toContain('2 jour(s)');
  });

  it('picks the goal with the highest streak when several qualify', () => {
    const shortStreak = makeGoal({
      id: '1',
      title: 'Short',
      entries: [{ date: '2026-08-20', value: 1 }],
    });
    const longStreak = makeGoal({
      id: '2',
      title: 'Long',
      entries: [
        { date: '2026-08-18', value: 1 },
        { date: '2026-08-19', value: 1 },
        { date: '2026-08-20', value: 1 },
      ],
    });
    const content = buildReminderContent([shortStreak, longStreak], today, true);
    expect(content.body).toContain('Long');
    expect(content.body).toContain('3 jour(s)');
  });
});
