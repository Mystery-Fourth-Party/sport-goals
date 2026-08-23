import { buildBackupPayload, parseBackupPayload, SCHEMA_VERSION } from './backup';
import { DEFAULT_SETTINGS, Settings } from './settingsStorage';
import { Goal } from './types';

const goal: Goal = {
  id: 'g1',
  title: '1000 Pompes',
  targetValue: 1000,
  unit: 'reps',
  createdAt: '2026-08-01T00:00:00.000Z',
  deadline: '2026-08-31T00:00:00.000Z',
  entries: [
    { date: '2026-08-01', value: 40, recordedAt: '2026-08-01T10:00:00.000Z' },
    { date: '2026-08-02', value: 35 }, // pas de recordedAt (entrée créée avant ce champ)
  ],
};

const settings: Settings = { ...DEFAULT_SETTINGS, dailyReminder: true };

const goalWithReminderOverrides: Goal = {
  ...goal,
  id: 'g2',
  reminderTime: '07:30',
  reminderEnabled: false,
};

describe('buildBackupPayload', () => {
  it('matches the documented shape, including a stats snapshot from stats.ts', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');

    expect(payload.schemaVersion).toBe(1);
    expect(typeof payload.exportedAt).toBe('string');
    expect(payload.settings).toEqual(settings);
    expect(payload.goals).toHaveLength(1);

    const g = payload.goals[0];
    expect(g.id).toBe('g1');
    expect(g.title).toBe('1000 Pompes');
    expect(g.unit).toBe('reps');
    expect(g.unitLabel).toBe('répétitions');
    expect(g.targetValue).toBe(1000);
    expect(g.createdAt).toBe(goal.createdAt);
    expect(g.deadline).toBe(goal.deadline);
    expect(g.entries).toEqual(goal.entries);
    // Instantané dérivé, calculé via stats.ts (pas réimplémenté ici) — on ne
    // revérifie pas le détail de getGoalStats, juste qu'il est bien là.
    expect(g.stats.actual).toBe(75);
    expect(g.stats.status).toBeDefined();
  });

  it('omits recordedAt from an entry that never had one, rather than serializing it as undefined', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const entryWithout = payload.goals[0].entries.find((e) => e.date === '2026-08-02');
    expect(entryWithout).toEqual({ date: '2026-08-02', value: 35 });
    expect(Object.prototype.hasOwnProperty.call(entryWithout, 'recordedAt')).toBe(false);
  });

  it('round-trips through JSON.stringify without a recordedAt key on entries that never had one', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const raw = JSON.stringify(payload);
    expect(raw).not.toContain('"recordedAt":null');
    const reparsed = JSON.parse(raw);
    expect(Object.keys(reparsed.goals[0].entries[1])).toEqual(['date', 'value']);
  });

  it('includes reminderTime/reminderEnabled when set, omits them when never set', () => {
    const payload = buildBackupPayload([goal, goalWithReminderOverrides], settings, '2026-08-20');

    const withoutOverrides = payload.goals[0];
    expect(withoutOverrides.reminderTime).toBeUndefined();
    expect(withoutOverrides.reminderEnabled).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(withoutOverrides, 'reminderTime')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(withoutOverrides, 'reminderEnabled')).toBe(false);

    const withOverrides = payload.goals[1];
    expect(withOverrides.reminderTime).toBe('07:30');
    expect(withOverrides.reminderEnabled).toBe(false);
  });
});

describe('parseBackupPayload', () => {
  it('accepts a valid file with settings', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const result = parseBackupPayload(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goals).toEqual([goal]);
    expect(result.settings).toEqual(settings);
  });

  it('accepts a valid file without settings, leaving settings undefined', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const { settings: _omit, ...withoutSettings } = payload;
    const result = parseBackupPayload(JSON.stringify(withoutSettings));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goals).toEqual([goal]);
    expect(result.settings).toBeUndefined();
  });

  it('merges partial settings with DEFAULT_SETTINGS, tolerating missing keys', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const raw = JSON.stringify({ ...payload, settings: { dailyReminder: true } });
    const result = parseBackupPayload(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual({ ...DEFAULT_SETTINGS, dailyReminder: true });
  });

  it('preserves entries with and without recordedAt', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const result = parseBackupPayload(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goals[0].entries[0].recordedAt).toBe('2026-08-01T10:00:00.000Z');
    expect(result.goals[0].entries[1].recordedAt).toBeUndefined();
  });

  it('round-trips reminderTime/reminderEnabled, present or absent', () => {
    const payload = buildBackupPayload([goal, goalWithReminderOverrides], settings, '2026-08-20');
    const result = parseBackupPayload(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goals).toEqual([goal, goalWithReminderOverrides]);
  });

  it('accepts a malformed reminderTime instead of rejecting the whole file — the fallback to the global time happens at usage, not at import (see notifications.ts)', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = JSON.parse(JSON.stringify(payload.goals)) as Record<string, unknown>[];
    goals[0].reminderTime = 'not-a-time';
    const raw = JSON.stringify({ ...payload, goals });
    const result = parseBackupPayload(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goals[0].reminderTime).toBe('not-a-time');
  });

  it("never lets the file's stats snapshot land in the parsed result", () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const result = parseBackupPayload(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result)).not.toContain('"stats"');
    expect('stats' in result.goals[0]).toBe(false);
  });

  it('rejects corrupted JSON', () => {
    const result = parseBackupPayload('{ not: valid json');
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it('rejects a payload that is valid JSON but not an object', () => {
    const result = parseBackupPayload('42');
    expect(result.ok).toBe(false);
  });

  it('rejects a missing schemaVersion', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const { schemaVersion: _omit, ...withoutVersion } = payload;
    const result = parseBackupPayload(JSON.stringify(withoutVersion));
    expect(result.ok).toBe(false);
  });

  it('rejects a schemaVersion other than 1', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const raw = JSON.stringify({ ...payload, schemaVersion: SCHEMA_VERSION + 1 });
    const result = parseBackupPayload(raw);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing goals field', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const { goals: _omit, ...withoutGoals } = payload;
    const result = parseBackupPayload(JSON.stringify(withoutGoals));
    expect(result.ok).toBe(false);
  });

  it('rejects goals that is not an array', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const raw = JSON.stringify({ ...payload, goals: { g1: goal } });
    const result = parseBackupPayload(raw);
    expect(result.ok).toBe(false);
  });

  it.each([
    ['missing id', (g: Record<string, unknown>) => delete g.id],
    ['missing title', (g: Record<string, unknown>) => delete g.title],
    ['targetValue as a string', (g: Record<string, unknown>) => (g.targetValue = '1000')],
    ['missing createdAt', (g: Record<string, unknown>) => delete g.createdAt],
    ['missing deadline', (g: Record<string, unknown>) => delete g.deadline],
    ['entries not an array', (g: Record<string, unknown>) => (g.entries = {})],
    [
      'an entry missing a date',
      (g: Record<string, unknown>) => {
        (g.entries as Record<string, unknown>[])[0] = { value: 1 };
      },
    ],
    ['reminderTime as a number', (g: Record<string, unknown>) => (g.reminderTime = 800)],
    ['reminderEnabled as a string', (g: Record<string, unknown>) => (g.reminderEnabled = 'false')],
  ])('rejects a malformed goal: %s', (_label, mutate) => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = JSON.parse(JSON.stringify(payload.goals)) as Record<string, unknown>[];
    mutate(goals[0]);
    const raw = JSON.stringify({ ...payload, goals });
    const result = parseBackupPayload(raw);
    expect(result.ok).toBe(false);
  });

  it('rejects a goal with an unknown unit', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = JSON.parse(JSON.stringify(payload.goals)) as Record<string, unknown>[];
    goals[0].unit = 'lightyears';
    const raw = JSON.stringify({ ...payload, goals });
    const result = parseBackupPayload(raw);
    expect(result.ok).toBe(false);
  });

  it('rejects settings that are present but not an object', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const raw = JSON.stringify({ ...payload, settings: 'not-an-object' });
    const result = parseBackupPayload(raw);
    expect(result.ok).toBe(false);
  });
});
