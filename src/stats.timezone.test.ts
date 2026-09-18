// L1-01 — base de calendrier des dates d'objectif.
//
// getGoalStats compare trois jours : celui de createdAt, celui de deadline,
// et `today`. Les deux premiers viennent de chaînes ISO écrites par
// `new Date(...).toISOString()` (voir GoalForm.tsx et app/goal/[id]/edit.tsx),
// le troisième de `todayStr()`, qui lit le calendrier *local*. Les trois
// doivent être sur la même base, sinon un objectif créé près de minuit voit
// sa durée, ses jours restants et son statut décalés d'un jour.
//
// Ces deux tests ne peuvent pas être rouges à UTC+0 : le jour UTC et le jour
// local y coïncident, il n'y a donc rien à détecter. Le premier est rouge
// dans tout fuseau à l'est d'UTC, le second dans tout fuseau à l'ouest. Le
// fuseau ne peut pas être forcé depuis le test : sous jest, écrire
// process.env.TZ ne réinitialise plus le cache de fuseau de Node (constaté
// sur Node 20 — la variable est bien posée, getTimezoneOffset ne bouge pas),
// contrairement à un process node ordinaire.
import { getGoalStats, todayStr } from './stats';
import { Goal } from './types';

// Reproduit ce que font les deux formulaires : une heure locale choisie par
// l'utilisateur, sérialisée en instant ISO.
function isoAtLocalTime(dayOffset: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function goalBetween(createdAt: string, deadline: string): Goal {
  return {
    id: 'tz',
    title: 'Objectif à cheval sur minuit UTC',
    targetValue: 100,
    unit: 'reps',
    createdAt,
    deadline,
    entries: [],
  };
}

describe('getGoalStats — jour local contre jour UTC', () => {
  // 00:30 heure locale tombe la veille en UTC dès que le fuseau est à l'est
  // d'UTC, ne serait-ce que d'une heure. Le décalage est donc visible dans
  // tout fuseau positif, été comme hiver.
  it('situe un objectif créé juste après minuit local au bon jour', () => {
    const goal = goalBetween(isoAtLocalTime(0, 0, 30), isoAtLocalTime(30, 0, 30));

    const s = getGoalStats(goal, todayStr());

    expect(s.totalDays).toBe(30);
    // Créé aujourd'hui : aucun jour écoulé, et les 30 jours sont devant.
    expect(s.elapsedDays).toBe(0);
    expect(s.remainingDays).toBe(30);
  });

  // Symétrique : 23:30 heure locale tombe le lendemain en UTC dès que le
  // fuseau est à l'ouest d'UTC.
  it('situe un objectif échéant juste avant minuit local au bon jour', () => {
    const goal = goalBetween(isoAtLocalTime(-30, 23, 30), isoAtLocalTime(0, 23, 30));

    const s = getGoalStats(goal, todayStr());

    expect(s.totalDays).toBe(30);
    // L'échéance est aujourd'hui : tout est écoulé, plus rien devant.
    expect(s.elapsedDays).toBe(30);
    expect(s.remainingDays).toBe(0);
  });
});
