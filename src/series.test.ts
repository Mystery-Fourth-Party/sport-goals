// Cas purs de src/series.ts : quelle occurrence fait foi quand des dates
// s'égalent ou sont illisibles, plafond de durée, champs facultatifs recopiés,
// tableau rendu tel quel quand il n'y a rien à faire, suppression d'une
// occurrence. Le comportement observable (moment, écriture, import) est dans
// goals-context.series.test.tsx.
import { advanceSeries, removeGoal } from './series';
import { dateStr, getGoalStats } from './stats';
import { Goal } from './types';

// 15/10 midi, heure locale : le jour reste le même sous les quatre fuseaux.
const NOW = new Date(2026, 9, 15, 12, 0);
const TODAY = '2026-10-15';

// Occurrence de 30 jours (14/09 → 14/10), close au 15/10.
function occurrence(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'a',
    title: 'Courir',
    targetValue: 100,
    unit: 'km',
    createdAt: new Date(2026, 8, 14, 12).toISOString(),
    deadline: new Date(2026, 9, 14, 12).toISOString(),
    entries: [{ date: '2026-09-20', value: 5 }],
    repeat: true,
    seriesId: 's1',
    ...overrides,
  };
}

let counter = 0;
const newId = () => `new-${++counter}`;

beforeEach(() => {
  counter = 0;
});

describe('advanceSeries — contenu de l’occurrence créée', () => {
  it('copies the title, target, unit and reminder settings, with empty entries', () => {
    const tip = occurrence({
      reminderEnabled: false,
      reminderTime: '06:45',
      remindAfterReached: true,
    });

    const [next] = advanceSeries([tip], TODAY, NOW, newId);

    expect(next).toMatchObject({
      id: 'new-1',
      title: 'Courir',
      targetValue: 100,
      unit: 'km',
      reminderEnabled: false,
      reminderTime: '06:45',
      remindAfterReached: true,
      entries: [],
      repeat: true,
      seriesId: 's1',
      createdAt: NOW.toISOString(),
    });
  });

  it('leaves out the reminder settings the occurrence never had', () => {
    const [next] = advanceSeries([occurrence()], TODAY, NOW, newId);

    expect('reminderEnabled' in next).toBe(false);
    expect('reminderTime' in next).toBe(false);
    expect('remindAfterReached' in next).toBe(false);
  });

  it('keeps the total duration, in local days', () => {
    const [next] = advanceSeries([occurrence()], TODAY, NOW, newId);

    expect(getGoalStats(next, TODAY).totalDays).toBe(30);
    expect(dateStr(new Date(next.deadline))).toBe('2026-11-14');
  });

  it('caps the duration at the maximum a goal may last', () => {
    const tip = occurrence({
      createdAt: new Date(2025, 8, 14, 12).toISOString(),
      deadline: new Date(2026, 9, 14, 12).toISOString(),
    });

    const [next] = advanceSeries([tip], TODAY, NOW, newId);

    expect(getGoalStats(next, TODAY).totalDays).toBe(365);
  });

  it('creates nothing when the creation date is unreadable, since the duration is unknown', () => {
    const tip = occurrence({ createdAt: 'pas une date' });
    const goals = [tip];

    expect(advanceSeries(goals, TODAY, NOW, newId)).toBe(goals);
  });
});

describe('advanceSeries — quelle occurrence fait foi', () => {
  const older = occurrence({
    id: 'older',
    title: 'Ancienne',
    createdAt: new Date(2026, 7, 1, 12).toISOString(),
    deadline: new Date(2026, 7, 31, 12).toISOString(),
  });

  it('takes the latest deadline whatever the order of the array', () => {
    const latest = occurrence({ id: 'latest', title: 'Dernière' });

    const forward = advanceSeries([older, latest], TODAY, NOW, newId);
    const backward = advanceSeries([latest, older], TODAY, NOW, newId);

    expect(forward[0].title).toBe('Dernière');
    expect(backward[0].title).toBe('Dernière');
  });

  it('breaks a deadline tie on the latest creation date', () => {
    const tied = occurrence({
      id: 'tied',
      title: 'Créée plus tard',
      createdAt: new Date(2026, 8, 20, 12).toISOString(),
    });

    const [next] = advanceSeries(
      [occurrence({ title: 'Créée plus tôt' }), tied],
      TODAY,
      NOW,
      newId,
    );

    expect(next.title).toBe('Créée plus tard');
  });

  it('breaks a full tie on the id, whatever the order', () => {
    const b = occurrence({ id: 'b', title: 'B' });
    const a = occurrence({ id: 'a', title: 'A' });

    expect(advanceSeries([a, b], TODAY, NOW, newId)[0].title).toBe('B');
    expect(advanceSeries([b, a], TODAY, NOW, newId)[0].title).toBe('B');
  });

  it('never picks an occurrence with an unreadable deadline over a readable one', () => {
    const broken = occurrence({ id: 'broken', deadline: 'pas une date', repeat: true });
    const goals = [broken, occurrence({ id: 'ok', repeat: false })];

    expect(advanceSeries(goals, TODAY, NOW, newId)).toBe(goals);
  });

  it('turns repeat off on every occurrence of the series, not only the latest', () => {
    const result = advanceSeries([older, occurrence({ id: 'latest' })], TODAY, NOW, newId);

    expect(result.filter((g) => g.repeat === true).map((g) => g.id)).toEqual(['new-1']);
  });

  it('leaves the repeat flag of other series alone', () => {
    const other = occurrence({
      id: 'other',
      seriesId: 's2',
      deadline: new Date(2026, 10, 20, 12).toISOString(),
    });

    const result = advanceSeries([occurrence(), other], TODAY, NOW, newId);

    expect(result.find((g) => g.id === 'other')).toBe(other);
  });

  it('ignores goals with no seriesId or an empty one', () => {
    const goals = [
      occurrence({ id: 'none', seriesId: undefined }),
      occurrence({ id: 'empty', seriesId: '' }),
    ];

    expect(advanceSeries(goals, TODAY, NOW, newId)).toBe(goals);
  });
});

describe('advanceSeries — rien à faire', () => {
  it('returns the very same array, so the caller neither renders nor saves', () => {
    const goals = [occurrence({ repeat: false })];

    expect(advanceSeries(goals, TODAY, NOW, newId)).toBe(goals);
  });

  it('does not rewrite a repeating occurrence that is not the latest of its series', () => {
    const closedRepeating = occurrence({
      id: 'closed',
      createdAt: new Date(2026, 7, 1, 12).toISOString(),
      deadline: new Date(2026, 7, 31, 12).toISOString(),
    });
    const running = occurrence({
      id: 'running',
      createdAt: new Date(2026, 9, 10, 12).toISOString(),
      deadline: new Date(2026, 10, 10, 12).toISOString(),
    });
    const goals = [closedRepeating, running];

    expect(advanceSeries(goals, TODAY, NOW, newId)).toBe(goals);
  });

  it('creates nothing on a second pass over its own result', () => {
    const first = advanceSeries([occurrence()], TODAY, NOW, newId);

    expect(advanceSeries(first, TODAY, NOW, newId)).toBe(first);
  });
});

describe('removeGoal', () => {
  const older = occurrence({
    id: 'older',
    createdAt: new Date(2026, 7, 1, 12).toISOString(),
    deadline: new Date(2026, 7, 31, 12).toISOString(),
  });
  const latest = occurrence({ id: 'latest' });

  it('removes a goal that belongs to no series', () => {
    const loose = occurrence({ id: 'loose', seriesId: undefined, repeat: undefined });

    expect(removeGoal([loose, latest], 'loose')).toEqual([latest]);
  });

  it('turns repeat off on the rest of the series when the latest occurrence is removed', () => {
    const result = removeGoal([older, latest], 'latest');

    expect(result.map((g) => [g.id, g.repeat])).toEqual([['older', false]]);
  });

  it('leaves the series untouched when an older occurrence is removed', () => {
    expect(removeGoal([older, latest], 'older')).toEqual([latest]);
  });

  it('only turns repeat off inside the series of the removed occurrence', () => {
    const other = occurrence({ id: 'other', seriesId: 's2' });

    const result = removeGoal([latest, other], 'latest');

    expect(result).toEqual([other]);
    expect(result[0].repeat).toBe(true);
  });

  it('returns the goals unchanged in content when the id matches nothing', () => {
    expect(removeGoal([latest], 'absent')).toEqual([latest]);
  });
});
