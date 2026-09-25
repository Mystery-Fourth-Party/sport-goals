import { buildBackupPayload, parseBackupPayload, SCHEMA_VERSION } from './backup';
import i18n from './i18n';
import { DEFAULT_SETTINGS, Settings } from './settingsStorage';
import { Goal } from './types';

// unitLabel (voir buildBackupPayload) dépend désormais de la langue
// courante d'i18next — fixée ici pour un test déterministe, indépendant de
// la langue détectée par défaut dans l'environnement Jest.
beforeAll(() => i18n.changeLanguage('fr'));

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
  remindAfterReached: true,
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

  it('includes reminderTime/reminderEnabled/remindAfterReached when set, omits them when never set', () => {
    const payload = buildBackupPayload([goal, goalWithReminderOverrides], settings, '2026-08-20');

    const withoutOverrides = payload.goals[0];
    expect(withoutOverrides.reminderTime).toBeUndefined();
    expect(withoutOverrides.reminderEnabled).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(withoutOverrides, 'reminderTime')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(withoutOverrides, 'reminderEnabled')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(withoutOverrides, 'remindAfterReached')).toBe(
      false,
    );

    const withOverrides = payload.goals[1];
    expect(withOverrides.reminderTime).toBe('07:30');
    expect(withOverrides.reminderEnabled).toBe(false);
    expect(withOverrides.remindAfterReached).toBe(true);
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

  it('round-trips reminderTime/reminderEnabled/remindAfterReached, present or absent', () => {
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
    [
      'remindAfterReached as a string',
      (g: Record<string, unknown>) => (g.remindAfterReached = 'true'),
    ],
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

// ─── Régression du retest terrain du 05/09 ──────────────────────────────

describe('buildBackupPayload — instantané de stats lisible', () => {
  // Confirmé sur un export réel : "actual": 12.399999999999999 pour
  // 5.3 + 4.1 + 3. Le bloc stats n'est jamais réimporté (voir
  // parseBackupPayload), mais le fichier est ouvrable par l'utilisateur.
  const decimalGoal: Goal = {
    id: 'g-km',
    title: 'Course',
    targetValue: 42.2,
    unit: 'km',
    createdAt: '2026-08-01T12:00:00.000Z',
    deadline: '2026-09-10T12:00:00.000Z',
    entries: [
      { date: '2026-08-19', value: 5.3 },
      { date: '2026-08-20', value: 4.1 },
      { date: '2026-08-15', value: 3 },
    ],
  };

  it('rounds the accumulated float so the artifact never reaches the file', () => {
    const payload = buildBackupPayload([decimalGoal], settings, '2026-08-21');
    const stats = payload.goals[0].stats;

    expect(stats.actual).toBe(12.4);
    expect(JSON.stringify(stats)).not.toContain('12.39999');
  });

  it('rounds the derived rates too, and leaves whole-number fields untouched', () => {
    const stats = buildBackupPayload([decimalGoal], settings, '2026-08-21').goals[0].stats;

    for (const value of [
      stats.progress,
      stats.expectedProgress,
      stats.dailyRequired,
      stats.dailyAvg,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      // Au plus 4 décimales : suffisant pour rester fidèle, assez court
      // pour qu'aucun artefact binaire ne subsiste.
      expect(String(value).replace(/^-?\d+\.?/, '').length).toBeLessThanOrEqual(4);
    }
    expect(stats.totalDays).toBe(40);
    expect(stats.elapsedDays).toBe(20);
  });
});

// ─── Branches de validation restées non couvertes (PR B du harnais) ─────
// isValidEntry/isValidGoal rejetaient déjà ces formes, mais aucune n'était
// exercée : seules les erreurs de plus haut niveau (fichier, version, unité)
// avaient un test.

describe('parseBackupPayload — formes malformées dans le tableau goals', () => {
  function rejectsGoals(goals: unknown) {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const result = parseBackupPayload(JSON.stringify({ ...payload, goals }));
    expect(result.ok).toBe(false);
  }

  it('rejects a goal that is not an object', () => {
    rejectsGoals([42]);
  });

  it('rejects a goal that is null', () => {
    rejectsGoals([null]);
  });

  it('rejects an entry that is not an object', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = JSON.parse(JSON.stringify(payload.goals)) as Record<string, unknown>[];
    goals[0].entries = ['2026-08-01'];
    rejectsGoals(goals);
  });

  it('rejects an entry whose date is not a string', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = JSON.parse(JSON.stringify(payload.goals)) as Record<string, unknown>[];
    goals[0].entries = [{ date: 20260801, value: 40 }];
    rejectsGoals(goals);
  });

  it('rejects an entry whose value is not a number', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = JSON.parse(JSON.stringify(payload.goals)) as Record<string, unknown>[];
    goals[0].entries = [{ date: '2026-08-01', value: '40' }];
    rejectsGoals(goals);
  });

  it('rejects an entry whose recordedAt is present but not a string', () => {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = JSON.parse(JSON.stringify(payload.goals)) as Record<string, unknown>[];
    goals[0].entries = [{ date: '2026-08-01', value: 40, recordedAt: 1754000000000 }];
    rejectsGoals(goals);
  });
});

// ─── Validation d'import (L1-04, L1-05, L1-09, L1-12, L2-07, L4-02) ─────
//
// isValidGoal répond « est-ce la bonne forme ». Les règles ci-dessous
// répondent « est-ce que ça a du sens », et chacune porte son propre
// message : un utilisateur qui a édité son fichier doit savoir quoi y
// corriger, pas seulement qu'il est refusé.
//
// Côté objectifs le fichier entier est rejeté — aucune valeur de repli ne
// pourrait remplacer une donnée de l'utilisateur sans l'inventer, et
// l'import est destructif (replaceAllGoals efface l'existant). Côté
// réglages, chaque champ a déjà un défaut documenté : le repli par champ
// suffit, voir le dernier describe de ce fichier.

describe('parseBackupPayload — cohérence des objectifs', () => {
  function exportedGoal(overrides: Record<string, unknown> = {}) {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    return { ...payload.goals[0], ...overrides };
  }

  function parseWithGoals(goals: unknown[]) {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    return parseBackupPayload(JSON.stringify({ ...payload, goals }));
  }

  function expectRejection(goals: unknown[], key: string, options?: Record<string, unknown>) {
    expect(parseWithGoals(goals)).toEqual({ ok: false, error: i18n.t(key, options) });
  }

  // L1-12 — les deux formulaires imposent déjà une cible strictement
  // positive ; l'import ne vérifiait que le type.
  describe('valeur cible', () => {
    it('rejects a target value of zero', () => {
      expectRejection([exportedGoal({ targetValue: 0 })], 'backup.invalidTargetValue');
    });

    it('rejects a negative target value', () => {
      expectRejection([exportedGoal({ targetValue: -10 })], 'backup.invalidTargetValue');
    });

    // Infinity ne s'écrit pas littéralement en JSON, mais un exposant hors
    // du domaine des flottants y arrive : JSON.parse rend Infinity sur
    // 1e400, et typeof Infinity vaut 'number'. Le JSON est bricolé à la
    // main ici parce que JSON.stringify réécrit Infinity en null.
    it('rejects a target value that overflows to Infinity', () => {
      const payload = buildBackupPayload([goal], settings, '2026-08-20');
      const raw = JSON.stringify(payload).replace('"targetValue":1000', '"targetValue":1e400');
      expect(raw).toContain('1e400');

      expect(parseBackupPayload(raw)).toEqual({
        ok: false,
        error: i18n.t('backup.invalidTargetValue'),
      });
    });

    it('accepts a positive target value', () => {
      expect(parseWithGoals([exportedGoal({ targetValue: 1 })]).ok).toBe(true);
    });
  });

  // L1-05 — typeof === 'string' laissait passer n'importe quelle chaîne.
  describe('dates', () => {
    it('rejects a createdAt that cannot be parsed as a date', () => {
      expectRejection([exportedGoal({ createdAt: 'pas une date' })], 'backup.invalidGoalDates');
    });

    it('rejects a deadline that cannot be parsed as a date', () => {
      expectRejection([exportedGoal({ deadline: 'bientot' })], 'backup.invalidGoalDates');
    });

    it('rejects a deadline earlier than createdAt', () => {
      expectRejection(
        [
          exportedGoal({
            createdAt: '2026-08-31T00:00:00.000Z',
            deadline: '2026-08-01T00:00:00.000Z',
          }),
        ],
        'backup.deadlineNotAfterCreatedAt',
      );
    });

    // Le cas de durée nulle de L1-10, jusqu'ici accepté : il produisait un
    // objectif dont le statut ne pouvait jamais descendre à « en retard ».
    // Le garde-fou posé dans stats.ts en PR4 reste en place ; cette règle
    // ferme la porte en amont plutôt que de le remplacer.
    it('rejects a deadline equal to createdAt', () => {
      expectRejection(
        [
          exportedGoal({
            createdAt: '2026-08-01T00:00:00.000Z',
            deadline: '2026-08-01T00:00:00.000Z',
          }),
        ],
        'backup.deadlineNotAfterCreatedAt',
      );
    });

    it('accepts a deadline after createdAt', () => {
      expect(parseWithGoals([exportedGoal()]).ok).toBe(true);
    });

    // R1 (suite) — le seul contrôle NaN laisse passer tout ce que le moteur
    // sait analyser : un nombre nu, un format anglais, une année étendue,
    // un jour impossible qui glisse au mois suivant. Une heure sans zone
    // est lue en heure locale, ce qui rendrait la comparaison avec
    // createdAt dépendante du fuseau. L'app n'écrit ces deux champs que
    // par toISOString(), toujours suffixé Z.
    it.each([
      ['createdAt', '1'],
      ['createdAt', '2026-02-30'],
      ['createdAt', '2026-02-30T00:00:00.000Z'],
      ['deadline', '+099999-01-01T00:00:00.000Z'],
      ['deadline', 'Oct 1 2026'],
      ['deadline', '2026-09-31T00:00:00.000Z'],
      ['deadline', '2026-08-31T10:00:00'],
    ])('rejects a %s of %j, which is not a zoned ISO date', (field, value) => {
      expectRejection([exportedGoal({ [field]: value })], 'backup.invalidGoalDates');
    });

    // Ce que toISOString() écrit est déjà couvert par exportedGoal() : ce
    // sont ici deux formes ISO sans ambiguïté de fuseau qu'un fichier
    // édité à la main peut porter.
    it.each([
      ['deadline', '2026-08-31'],
      ['deadline', '2026-08-31T10:00:00+02:00'],
    ])('accepts a %s of %j, which is an unambiguous ISO date', (field, value) => {
      expect(parseWithGoals([exportedGoal({ [field]: value })]).ok).toBe(true);
    });
  });

  // L1-09 — updateGoal et deleteGoal opèrent par .map/.filter sur l'id
  // (voir goals-context.tsx) : deux objectifs au même id sont modifiés ou
  // supprimés ensemble, sans que rien ne le signale.
  describe('identifiants', () => {
    it('rejects two goals sharing the same id', () => {
      expectRejection(
        [exportedGoal({ id: 'meme' }), exportedGoal({ id: 'meme', title: 'Autre objectif' })],
        'backup.duplicateGoalIds',
      );
    });

    it('accepts two goals with distinct ids', () => {
      expect(parseWithGoals([exportedGoal({ id: 'a' }), exportedGoal({ id: 'b' })]).ok).toBe(true);
    });
  });

  describe('valeurs de progression', () => {
    it('rejects a negative entry value', () => {
      expectRejection(
        [exportedGoal({ entries: [{ date: '2026-08-01', value: -5 }] })],
        'backup.invalidEntryValue',
      );
    });

    it('rejects an entry value that overflows to Infinity', () => {
      const payload = buildBackupPayload([goal], settings, '2026-08-20');
      const raw = JSON.stringify(payload).replace('"value":40', '"value":1e400');
      expect(raw).toContain('1e400');

      expect(parseBackupPayload(raw)).toEqual({
        ok: false,
        error: i18n.t('backup.invalidEntryValue'),
      });
    });

    // value: 0 reste valide et signifiant — voir deleteEntry dans
    // goals-context.tsx, où « pas d'entrée ce jour-là » doit rester
    // distinct de « une entrée à 0 ce jour-là ».
    it('accepts an entry value of zero', () => {
      expect(
        parseWithGoals([exportedGoal({ entries: [{ date: '2026-08-01', value: 0 }] })]).ok,
      ).toBe(true);
    });
  });

  // R1 — isValidEntry ne vérifiait que le type de e.date. Le tri des
  // entrées compare des chaînes et calcStreak/getGoalStats lisent le champ
  // comme un "YYYY-MM-DD" produit par dateStr() : une autre forme cassait
  // l'ordre chronologique sans rien signaler. "2026-02-30" couvre le cas
  // que new Date() ne rejette pas (V8 le fait glisser au 2 mars).
  describe("dates d'entrée", () => {
    it.each([
      ['not-a-date'],
      ['23/09/2026'],
      [''],
      ['2026-9-3'],
      ['2026-13-01'],
      ['2026-02-30'],
      ['2026-08-01T00:00:00.000Z'],
    ])('rejects an entry dated %j, naming the goal and the date', (date) => {
      expectRejection(
        [exportedGoal({ title: 'Course', entries: [{ date, value: 5 }] })],
        'backup.invalidEntryDate',
        { title: 'Course', date },
      );
    });

    it('accepts a leap day in a leap year', () => {
      expect(
        parseWithGoals([exportedGoal({ entries: [{ date: '2028-02-29', value: 5 }] })]).ok,
      ).toBe(true);
    });
  });

  // L4-02 — deux entrées à la même date étaient lues de trois façons
  // incompatibles en aval : sommées par getGoalStats, dernière-gagne par
  // calcStreak, première-trouvée par addProgress. Rejet plutôt que
  // réparation : l'app ne sait pas produire ce cas (addProgress fusionne,
  // updateEntry remplace en place), donc un doublon signale un fichier
  // abîmé, pas deux séances. Message interpolé, seule règle où
  // l'utilisateur ne peut rien corriger sans savoir où regarder.
  describe('entrées en double', () => {
    it('rejects two entries sharing a date, naming the goal and the date', () => {
      expectRejection(
        [
          exportedGoal({
            title: 'Course',
            entries: [
              { date: '2026-08-01', value: 5 },
              { date: '2026-08-02', value: 3 },
              { date: '2026-08-01', value: 7 },
            ],
          }),
        ],
        'backup.duplicateEntryDates',
        { title: 'Course', date: '2026-08-01' },
      );
    });

    it('accepts entries whose dates are all distinct', () => {
      expect(
        parseWithGoals([
          exportedGoal({
            entries: [
              { date: '2026-08-01', value: 5 },
              { date: '2026-08-02', value: 3 },
            ],
          }),
        ]).ok,
      ).toBe(true);
    });
  });
});

// L2-07 — GoalHistoryList fait [...entries].reverse().slice(0, 12) et
// RecentSessionsCard .slice(-7) : les deux supposent l'ordre chronologique,
// que rien ne garantissait pour un fichier importé.
describe('parseBackupPayload — ordre des entrées', () => {
  function parseWithEntries(entries: unknown[]) {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const goals = [{ ...payload.goals[0], entries }];
    return parseBackupPayload(JSON.stringify({ ...payload, goals }));
  }

  it('sorts entries by date, whatever their order in the file', () => {
    const result = parseWithEntries([
      { date: '2026-08-03', value: 3 },
      { date: '2026-08-01', value: 1 },
      { date: '2026-08-02', value: 2 },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goals[0].entries.map((e) => e.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ]);
  });

  it('keeps each value and recordedAt attached to its own entry while sorting', () => {
    const result = parseWithEntries([
      { date: '2026-08-03', value: 3, recordedAt: '2026-08-03T10:00:00.000Z' },
      { date: '2026-08-01', value: 1 },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goals[0].entries).toEqual([
      { date: '2026-08-01', value: 1 },
      { date: '2026-08-03', value: 3, recordedAt: '2026-08-03T10:00:00.000Z' },
    ]);
  });
});

// L1-04 — payload.settings n'était vérifié que comme objet, puis fusionné
// tel quel. Chaque champ a un défaut documenté dans DEFAULT_SETTINGS : un
// champ mal typé retombe dessus, plutôt que de faire rejeter le fichier et
// avec lui les objectifs, qui sont la partie qui a de la valeur.
describe('parseBackupPayload — réglages mal typés', () => {
  function importedSettings(raw: Record<string, unknown>): Settings | undefined {
    const payload = buildBackupPayload([goal], settings, '2026-08-20');
    const result = parseBackupPayload(JSON.stringify({ ...payload, settings: raw }));
    if (!result.ok) {
      throw new Error('fichier rejeté alors qu un repli était attendu : ' + result.error);
    }
    return result.settings;
  }

  it('falls back to the default for each mistyped field', () => {
    const imported = importedSettings({
      dailyReminder: 'oui',
      reminderTime: 42,
      goalReachedNotifs: 1,
      almostThereNotifs: null,
      streakAlert: 'non',
    });

    expect(imported).toEqual(DEFAULT_SETTINGS);
  });

  it('drops a language outside the supported set rather than keeping it', () => {
    const imported = importedSettings({ ...DEFAULT_SETTINGS, language: 'xx' });

    // Absent = suit la langue détectée de l'appareil (voir
    // settingsStorage.ts), ce qui est le défaut documenté de ce champ.
    expect(imported?.language).toBeUndefined();
  });

  it('keeps a supported language', () => {
    expect(importedSettings({ ...DEFAULT_SETTINGS, language: 'en' })?.language).toBe('en');
  });

  it('keeps every well-typed value untouched', () => {
    const custom: Settings = {
      dailyReminder: true,
      reminderTime: '07:30',
      goalReachedNotifs: true,
      almostThereNotifs: false,
      streakAlert: false,
      language: 'fr',
    };

    expect(importedSettings({ ...custom })).toEqual(custom);
  });

  // Même arbitrage que pour le reminderTime d'un objectif, déjà testé plus
  // haut dans ce fichier : le type est vérifié, pas le format. Le repli sur
  // l'horaire global se fait à l'usage (voir notifications.ts), et valider
  // le format ici dupliquerait parseReminderTime.
  it('keeps a malformed reminderTime as long as it is a string', () => {
    expect(importedSettings({ ...DEFAULT_SETTINGS, reminderTime: '99:99' })?.reminderTime).toBe(
      '99:99',
    );
  });
});
