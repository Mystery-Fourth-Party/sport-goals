import i18n from './i18n';
import { Goal } from './types';
import {
  calcStreak,
  dateStr,
  fmt,
  getGoalStats,
  getWeeklyStats,
  parseDate,
  splitGoalsByStatus,
  statusLabel,
} from './stats';

// Objectif "1000 Pompes" du prototype Figma Make (design-reference/figma-make-source.tsx,
// SAMPLE_GOALS[0]), avec startDate/endDate portés sur createdAt/deadline (ISO complet).
// Les résultats attendus ci-dessous ont été relevés en explorant le prototype publié
// le 21/08/2026 (écran Détail : 770/1000, 77%, attendu 63%, streak 20, rythme actuel
// 41/j, requis 21/j) — ce test protège contre une régression du portage.
const pompes: Goal = {
  id: '1',
  title: '1000 Pompes',
  targetValue: 1000,
  unit: 'reps',
  createdAt: '2026-08-01T00:00:00.000Z',
  deadline: '2026-08-31T00:00:00.000Z',
  entries: [
    { date: '2026-08-01', value: 40 },
    { date: '2026-08-02', value: 35 },
    { date: '2026-08-03', value: 42 },
    { date: '2026-08-04', value: 38 },
    { date: '2026-08-05', value: 45 },
    { date: '2026-08-06', value: 30 },
    { date: '2026-08-07', value: 40 },
    { date: '2026-08-08', value: 38 },
    { date: '2026-08-09', value: 42 },
    { date: '2026-08-10', value: 35 },
    { date: '2026-08-11', value: 45 },
    { date: '2026-08-12', value: 28 },
    { date: '2026-08-13', value: 40 },
    { date: '2026-08-14', value: 38 },
    { date: '2026-08-15', value: 42 },
    { date: '2026-08-16', value: 35 },
    { date: '2026-08-17', value: 40 },
    { date: '2026-08-18', value: 38 },
    { date: '2026-08-19', value: 42 },
    { date: '2026-08-20', value: 37 },
  ],
};

const TODAY = '2026-08-20';

describe('getGoalStats', () => {
  it('matches the values observed in the Figma Make prototype', () => {
    const s = getGoalStats(pompes, TODAY);

    expect(s.actual).toBe(770);
    expect(Math.round(s.progress * 100)).toBe(77);
    expect(Math.round(s.expectedProgress * 100)).toBe(63);
    expect(s.streak).toBe(20);
    expect(s.elapsedDays).toBe(19);
    expect(s.totalDays).toBe(30);
    expect(s.remainingDays).toBe(11);
    expect(fmt(s.actual / s.elapsedDays, pompes.unit)).toBe('41');
    expect(fmt(s.dailyRequired, pompes.unit)).toBe('21');
    expect(s.status).toBe('ahead');
  });

  it('treats a goal with no entries yet as not-started', () => {
    const fresh: Goal = { ...pompes, entries: [] };
    const s = getGoalStats(fresh, '2026-08-01');
    expect(s.status).toBe('not-started');
    expect(s.actual).toBe(0);
  });

  it('is not not-started when created today but an entry already exists for today', () => {
    const createdToday: Goal = {
      ...pompes,
      createdAt: '2026-08-01T00:00:00.000Z',
      entries: [{ date: '2026-08-01', value: 10 }],
    };
    const s = getGoalStats(createdToday, '2026-08-01');
    expect(s.status).not.toBe('not-started');
    expect(s.actual).toBe(10);
  });

  it('marks a goal completed once actual reaches the target, even past the deadline', () => {
    const done: Goal = { ...pompes, entries: [{ date: '2026-08-31', value: 1000 }] };
    const s = getGoalStats(done, '2026-09-05');
    expect(s.status).toBe('completed');
    expect(s.progress).toBe(1);
  });

  it('lets progress exceed 100% when the goal is overshot, and still marks it completed', () => {
    const overshot: Goal = { ...pompes, entries: [{ date: '2026-08-31', value: 1500 }] };
    const s = getGoalStats(overshot, '2026-09-05');
    expect(s.status).toBe('completed');
    expect(s.progress).toBe(1.5);
  });

  it('is missing entries safe (defaults to an empty history)', () => {
    const legacy = { ...pompes } as Goal;
    delete (legacy as { entries?: unknown }).entries;
    const s = getGoalStats(legacy, TODAY);
    expect(s.actual).toBe(0);
  });
});

describe('calcStreak', () => {
  it('stops counting at the first missing or zero-value day walking backwards from today', () => {
    const entries = [
      { date: '2026-08-18', value: 10 },
      { date: '2026-08-19', value: 0 },
      { date: '2026-08-20', value: 5 },
    ];
    expect(calcStreak(entries, '2026-08-20')).toBe(1);
  });
});

describe('getWeeklyStats', () => {
  it('builds a 7-day window ending on today and ranks goals by progress', () => {
    const behind: Goal = {
      ...pompes,
      id: '2',
      title: 'Behind goal',
      entries: [{ date: TODAY, value: 1 }],
    };
    const w = getWeeklyStats([pompes, behind], TODAY);

    expect(w.weekDates).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
    expect(w.mostAdvanced?.goal.id).toBe('1');
    expect(w.mostBehind?.goal.id).toBe('2');
  });
});

describe('splitGoalsByStatus', () => {
  // Cible atteinte quel que soit le statut d'avancement attendu ce jour-là.
  const completed: Goal = { ...pompes, id: 'done', entries: [{ date: '2026-08-31', value: 1000 }] };
  // Aucune entrée : pas "completed" (voir getGoalStats — not-started).
  const active: Goal = { ...pompes, id: 'active', entries: [] };

  it('splits a mix of active and completed goals, keeping original order in each list', () => {
    const goals = [active, completed, pompes];
    const result = splitGoalsByStatus(goals, TODAY);

    expect(result.active.map((g) => g.id)).toEqual(['active', '1']);
    expect(result.completed.map((g) => g.id)).toEqual(['done']);
  });

  it('puts everything in active when nothing is completed', () => {
    const result = splitGoalsByStatus([active, pompes], TODAY);
    expect(result.active).toHaveLength(2);
    expect(result.completed).toEqual([]);
  });

  it('puts everything in completed when all goals are done', () => {
    const otherCompleted: Goal = { ...completed, id: 'done-2' };
    const result = splitGoalsByStatus([completed, otherCompleted], TODAY);
    expect(result.completed.map((g) => g.id)).toEqual(['done', 'done-2']);
    expect(result.active).toEqual([]);
  });

  it('returns two empty lists for an empty input', () => {
    expect(splitGoalsByStatus([], TODAY)).toEqual({ active: [], completed: [] });
  });
});

describe('date helpers', () => {
  it('round-trip a date through parseDate/dateStr', () => {
    expect(dateStr(parseDate('2026-08-20'))).toBe('2026-08-20');
  });
});

// ─── Régressions du retest terrain du 05/09 ─────────────────────────────

describe('getGoalStats — seuils de statut et rythme requis', () => {
  // La différence progress - expectedProgress vaut ici 0,05 pile sur le
  // papier, mais 0.050000000000000044 en flottant : le seuil `> 0.05`
  // basculait le statut sur une poussière invisible à l'utilisateur, qui
  // voit 55 % contre 50 % attendu.
  it('does not flip to ahead on a floating-point crumb at the +0.05 threshold', () => {
    const goal: Goal = {
      id: 'boundary-ahead',
      title: 'Frontière avance',
      targetValue: 100,
      unit: 'reps',
      createdAt: '2026-08-01T12:00:00.000Z',
      deadline: '2026-09-10T12:00:00.000Z',
      entries: [{ date: '2026-08-15', value: 55 }],
    };
    const s = getGoalStats(goal, '2026-08-21');

    expect(s.progress).toBe(0.55);
    expect(s.expectedProgress).toBe(0.5);
    expect(s.status).toBe('on-track');
  });

  it('does not stay on-track on a floating-point crumb at the -0.1 threshold', () => {
    const goal: Goal = {
      id: 'boundary-late',
      title: 'Frontière retard',
      targetValue: 100,
      unit: 'reps',
      createdAt: '2026-08-01T12:00:00.000Z',
      deadline: '2026-09-10T12:00:00.000Z',
      entries: [{ date: '2026-08-15', value: 40 }],
    };
    const s = getGoalStats(goal, '2026-08-21');

    expect(s.progress).toBe(0.4);
    expect(s.expectedProgress).toBe(0.5);
    expect(s.status).toBe('late');
  });

  it('never reports a negative daily requirement when the target is already exceeded', () => {
    const goal: Goal = {
      id: 'overshot',
      title: 'Dépassé',
      targetValue: 50,
      unit: 'km',
      createdAt: '2026-08-01T12:00:00.000Z',
      deadline: '2026-09-10T12:00:00.000Z',
      entries: [{ date: '2026-08-15', value: 75 }],
    };
    expect(getGoalStats(goal, '2026-08-21').dailyRequired).toBe(0);
  });

  it('never reports a negative daily requirement when the target is zero', () => {
    const goal: Goal = {
      id: 'zero-target',
      title: 'Cible nulle',
      targetValue: 0,
      unit: 'reps',
      createdAt: '2026-08-01T12:00:00.000Z',
      deadline: '2026-09-10T12:00:00.000Z',
      entries: [{ date: '2026-08-15', value: 30 }],
    };
    const s = getGoalStats(goal, '2026-08-21');

    expect(s.progress).toBe(0);
    expect(s.dailyRequired).toBe(0);
  });
});

// ─── Branches restées non couvertes (PR B du harnais) ───────────────────
// Repérées via le branchMap d'istanbul (coverage-final.json) : la colonne
// "Uncovered Line #s" du rapport texte ne montre pas les branches partielles
// sur une ligne par ailleurs exécutée.

// L1-10 — createdAt === deadline : totalDays vaut 0. Les deux divisions par
// totalDays retombaient alors sur une garde à 0, ce qui rendait le statut
// "late" inatteignable quelle que soit la progression réelle, et annonçait
// une moyenne quotidienne requise nulle. Atteignable par import (cas C4 du
// jeu de test) ; plus depuis les formulaires depuis la PR #19.
//
// Ce bloc remplace un test écrit pendant le harnais de couverture (PR #21)
// qui figeait expectedProgress et dailyAvg à 0 — c'est-à-dire qui
// verrouillait ce défaut. Voir le corps de la PR pour le détail.
describe('getGoalStats — durée nulle', () => {
  const zeroDuration: Goal = {
    id: 'zero-duration',
    title: 'Créé et échu le même jour',
    targetValue: 50,
    unit: 'reps',
    createdAt: '2026-08-21T12:00:00.000Z',
    deadline: '2026-08-21T12:00:00.000Z',
    entries: [{ date: '2026-08-21', value: 10 }],
  };

  // La fenêtre tient dans une seule journée : une fois ce jour arrivé, elle
  // est entièrement écoulée, donc 100 % est attendu — et la cible entière
  // est due dans la journée.
  it('treats the whole window as elapsed once the single day has come', () => {
    const s = getGoalStats(zeroDuration, '2026-08-21');

    expect(s.totalDays).toBe(0);
    expect(s.expectedProgress).toBe(1);
    expect(s.dailyAvg).toBe(50);
    expect(Number.isFinite(s.expectedProgress)).toBe(true);
    expect(Number.isFinite(s.dailyAvg)).toBe(true);
  });

  // Conséquence directe : le statut peut enfin descendre à "late".
  it('lets the status reach late for a zero-duration goal left unfinished', () => {
    const s = getGoalStats(zeroDuration, '2026-08-21');

    // 10 / 50 = 20 % réalisés contre 100 % attendus.
    expect(s.status).toBe('late');
  });

  // Autre branche de la même garde : tant que le jour n'est pas arrivé,
  // rien n'est encore attendu.
  it('expects nothing yet while the single day is still ahead', () => {
    const s = getGoalStats(zeroDuration, '2026-08-20');

    expect(s.expectedProgress).toBe(0);
  });
});

describe('getWeeklyStats — objectif sans historique', () => {
  // Même repli que getGoalStats ci-dessus : un objectif enregistré avant
  // l'ajout du champ entries ne doit pas faire planter le résumé.
  it('treats a goal whose entries field is missing as a goal with no session', () => {
    const legacy = { ...pompes, id: 'legacy' } as Goal;
    delete (legacy as { entries?: unknown }).entries;

    const w = getWeeklyStats([legacy], TODAY);

    expect(w.sessionsPerDay.every((d) => d.count === 0)).toBe(true);
    expect(w.activeDays).toBe(0);
    expect(w.totalSessions).toBe(0);
  });
});

describe('fmt', () => {
  // Seule unité à garder une décimale : une distance de 12,4 km ne doit pas
  // s'afficher "12".
  it('keeps one decimal for km', () => {
    expect(fmt(12.44, 'km')).toBe('12.4');
    expect(fmt(12, 'km')).toBe('12.0');
  });

  it('rounds to the nearest integer for every other unit', () => {
    expect(fmt(12.4, 'reps')).toBe('12');
    expect(fmt(12.6, 'min')).toBe('13');
    expect(fmt(5.25, 'h')).toBe('5');
  });
});

describe('statusLabel', () => {
  it('translates every status, and follows a language change', async () => {
    await i18n.changeLanguage('fr');
    expect(statusLabel('ahead')).toBe('En avance');
    expect(statusLabel('on-track')).toBe('Dans les temps');
    expect(statusLabel('late')).toBe('En retard');
    expect(statusLabel('completed')).toBe('Terminé ✓');
    expect(statusLabel('not-started')).toBe('Pas commencé');

    await i18n.changeLanguage('en');
    expect(statusLabel('ahead')).toBe('Ahead');

    await i18n.changeLanguage('fr');
  });
});

// L1-02 — remainingDays est planché à 0, et dailyRequired en dépendait
// directement : dès le jour de l'échéance, et tous les jours suivants, le
// rythme de rattrapage annoncé tombait à 0. Trois composants l'affichent
// sans garde-fou (GoalCard, GoalDetailHeader, GoalProgressCard), le
// quatrième s'en protège déjà (app/weekly.tsx).
describe('getGoalStats — rythme de rattrapage après échéance', () => {
  const enRetard: Goal = {
    id: 'echu',
    title: 'Échéance dépassée',
    targetValue: 100,
    unit: 'km',
    createdAt: '2026-08-01T12:00:00.000Z',
    deadline: '2026-08-31T12:00:00.000Z',
    entries: [{ date: '2026-08-10', value: 40 }],
  };

  it('reports the full remaining amount on the deadline day itself', () => {
    const s = getGoalStats(enRetard, '2026-08-31');

    expect(s.remainingDays).toBe(0);
    // Il reste 60 km, et il ne reste que cette journée pour les faire.
    expect(s.dailyRequired).toBe(60);
  });

  it('keeps reporting a real catch-up pace days after the deadline', () => {
    const s = getGoalStats(enRetard, '2026-09-05');

    expect(s.remainingDays).toBe(0);
    expect(s.dailyRequired).toBe(60);
  });

  // Le plancher à 0 existant ne doit pas être emporté par le correctif :
  // plus rien à rattraper reste plus rien à rattraper.
  it('still reports 0 after the deadline when the target is already met', () => {
    const atteint: Goal = { ...enRetard, entries: [{ date: '2026-08-10', value: 120 }] };

    expect(getGoalStats(atteint, '2026-09-05').dailyRequired).toBe(0);
  });
});
