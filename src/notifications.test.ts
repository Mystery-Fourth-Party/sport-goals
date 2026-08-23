import * as Notifications from 'expo-notifications';
import {
  buildReminderContent,
  computeNextReminderDate,
  groupPendingGoalsByReminderTime,
  ongoingGoalsWithoutTodayEntry,
  parseReminderTime,
  rescheduleDailyReminder,
} from './notifications';
import { Goal } from './types';

// expo-notifications mocké pour la première couverture de
// rescheduleDailyReminder (orchestration) ci-dessous — le reste de ce
// fichier ne teste que la logique pure et n'en a pas besoin.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mockedGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockedSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockedCancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;

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

  it('excludes a goal with reminderEnabled: false, even if otherwise eligible', () => {
    const excluded = makeGoal({ id: '1', entries: [], reminderEnabled: false });
    const included = makeGoal({ id: '2', entries: [] });
    expect(ongoingGoalsWithoutTodayEntry([excluded, included], today)).toEqual([included]);
  });

  it.each([
    ['absent', undefined],
    ['true', true],
  ])('keeps a goal included when reminderEnabled is %s', (_label, reminderEnabled) => {
    const goal = makeGoal({ id: '1', entries: [], reminderEnabled });
    expect(ongoingGoalsWithoutTodayEntry([goal], today)).toEqual([goal]);
  });
});

describe('groupPendingGoalsByReminderTime', () => {
  it('groups goals without an override under the global default time', () => {
    const a = makeGoal({ id: '1', entries: [] });
    const b = makeGoal({ id: '2', entries: [] });
    const groups = groupPendingGoalsByReminderTime([a, b], '20:00');
    expect(groups).toEqual(new Map([['20:00', [a, b]]]));
  });

  it('groups a goal with a valid override separately from the default', () => {
    const defaultTimeGoal = makeGoal({ id: '1', entries: [] });
    const customTimeGoal = makeGoal({ id: '2', entries: [], reminderTime: '07:00' });
    const groups = groupPendingGoalsByReminderTime([defaultTimeGoal, customTimeGoal], '20:00');
    expect(groups).toEqual(
      new Map([
        ['20:00', [defaultTimeGoal]],
        ['07:00', [customTimeGoal]],
      ]),
    );
  });

  it('falls back to the default time for a malformed override', () => {
    const goal = makeGoal({ id: '1', entries: [], reminderTime: 'not-a-time' });
    const groups = groupPendingGoalsByReminderTime([goal], '20:00');
    expect(groups).toEqual(new Map([['20:00', [goal]]]));
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

describe('rescheduleDailyReminder', () => {
  const today = '2026-08-21';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // 21 août 2026, 10:00 : après 07:00 (bascule au lendemain) mais avant
    // 20:00 (reste aujourd'hui) — les deux groupes d'horaire des tests
    // ci-dessous atterrissent donc sur des dates différentes.
    jest.setSystemTime(new Date(2026, 7, 21, 10, 0, 0));
    mockedGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels once and does not schedule anything when nothing is pending', async () => {
    const completed = makeGoal({
      id: '1',
      targetValue: 10,
      entries: [{ date: '2026-08-01', value: 10 }],
    });
    const result = await rescheduleDailyReminder([completed], today, '20:00', false);

    expect(result).toEqual({ ok: true });
    expect(mockedCancelAll).toHaveBeenCalledTimes(1);
    expect(mockedSchedule).not.toHaveBeenCalled();
  });

  it('schedules one notification per distinct reminder-time group, with the right content and target time per group', async () => {
    const defaultTimeGoal = makeGoal({ id: '1', title: 'Default Time Goal', entries: [] });
    const streakGoal = makeGoal({
      id: '2',
      title: 'Custom Time Goal',
      reminderTime: '07:00',
      entries: [
        { date: '2026-08-19', value: 10 },
        { date: '2026-08-20', value: 10 },
      ],
    });

    const result = await rescheduleDailyReminder(
      [defaultTimeGoal, streakGoal],
      today,
      '20:00',
      true, // streakAlertEnabled
    );

    expect(result).toEqual({ ok: true });
    expect(mockedCancelAll).toHaveBeenCalledTimes(1);
    expect(mockedSchedule).toHaveBeenCalledTimes(2);

    const calls = mockedSchedule.mock.calls.map((call) => call[0]);
    const defaultCall = calls.find((c) => c.content.body.includes('pas encore ajouté'));
    const streakCall = calls.find((c) => c.content.body.includes('Custom Time Goal'));

    // Contenu par groupe : seul le groupe du streakGoal mentionne son streak
    // (buildReminderContent, inchangée, appelée séparément par groupe).
    expect(defaultCall).toBeDefined();
    expect(streakCall).toBeDefined();
    expect(streakCall?.content.body).toContain('2 jour(s)');

    // Horaire par groupe : 20:00 n'est pas encore passé (now = 10:00) donc
    // reste aujourd'hui ; 07:00 est déjà passé donc bascule à demain.
    expect(defaultCall?.trigger.date).toEqual(new Date(2026, 7, 21, 20, 0, 0));
    expect(streakCall?.trigger.date).toEqual(new Date(2026, 7, 22, 7, 0, 0));
  });

  it('rejects a malformed global reminder time without scheduling anything', async () => {
    const goal = makeGoal({ id: '1', entries: [] });
    const result = await rescheduleDailyReminder([goal], today, 'not-a-time', false);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mockedSchedule).not.toHaveBeenCalled();
  });

  it('surfaces a denied permission without scheduling anything', async () => {
    mockedGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const goal = makeGoal({ id: '1', entries: [] });

    const result = await rescheduleDailyReminder([goal], today, '20:00', false);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mockedSchedule).not.toHaveBeenCalled();
  });
});
