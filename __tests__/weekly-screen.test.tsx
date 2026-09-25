// L3-03 et L4-03, écran Résumé hebdomadaire.
//
// Placé ici et non à côté de app/weekly.tsx : le require.context
// d'expo-router n'exclut que les fichiers `+api` et `+html`, donc tout autre
// fichier de app/ devient une route (voir goal-edit-screen.test.tsx).
import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import WeeklyScreen from '../app/weekly';
import { GoalsProvider } from '../src/goals-context';
import i18n from '../src/i18n';
import { SettingsProvider } from '../src/settings-context';
import { loadGoals, saveGoals } from '../src/storage';
import { StorageStatusProvider } from '../src/storage-status';
import { statusColors } from '../src/theme';
import { Goal } from '../src/types';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

jest.mock('../src/storage', () => {
  const actual = jest.requireActual('../src/storage');
  return { ...actual, loadGoals: jest.fn(), saveGoals: jest.fn() };
});

const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;

beforeAll(() => i18n.changeLanguage('fr'));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedSaveGoals.mockReset().mockResolvedValue(true);
});

// Objectif à 90 % de progression brute — donc le plus avancé du lot — mais
// en retard sur son propre rythme attendu : son échéance tombe aujourd'hui,
// 100 % sont attendus. C'est exactement le cas que la couleur verte codée
// en dur rendait trompeur. Échéance aujourd'hui et non hier : un objectif
// échu est clos, donc « non atteint », et quitte l'écran Hebdo.
function avanceMaisEnRetard(): Goal {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - 30);
  const deadline = new Date();
  return {
    id: 'avance-en-retard',
    title: 'Presque fini mais en retard',
    targetValue: 100,
    unit: 'km',
    createdAt: createdAt.toISOString(),
    deadline: deadline.toISOString(),
    entries: [{ date: '2026-09-01', value: 90 }],
  };
}

async function renderWeekly(goals: Goal[]) {
  mockedLoadGoals.mockResolvedValue({ value: goals, ok: true });
  render(
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>
          <WeeklyScreen />
        </GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>,
  );
  await act(async () => {});
}

describe('WeeklyScreen — carte « le plus avancé »', () => {
  it('colours the percentage after the goal status instead of always green', async () => {
    const goal = avanceMaisEnRetard();
    await renderWeekly([goal, { ...goal, id: 'autre', title: 'Autre', entries: [] }]);

    const percent = screen.getByText('90%');
    // Aplati : le style est un tableau [styles.goalPercent, { color }].
    const style = Array.isArray(percent.props.style)
      ? Object.assign({}, ...percent.props.style.flat())
      : percent.props.style;

    expect(style.color).toBe(statusColors.late.text);
    expect(style.color).not.toBe(statusColors.ahead.text);
  });
});

describe('WeeklyScreen — liste par objectif', () => {
  function goal(id: string, title: string, deadlineOffset: number, total: number): Goal {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - 20);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineOffset);
    return {
      id,
      title,
      targetValue: 100,
      unit: 'reps',
      createdAt: createdAt.toISOString(),
      deadline: deadline.toISOString(),
      entries: [{ date: '2026-08-01', value: total }],
    };
  }

  it('ne liste que les objectifs non clos, chacun avec son badge de statut', async () => {
    await renderWeekly([
      goal('open', 'Ouvert en retard', 10, 5),
      goal('reached', 'Atteint en avance', 10, 120),
      goal('closed', 'Échu hier', -1, 5),
    ]);

    expect(screen.getAllByText('Ouvert en retard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Atteint en avance').length).toBeGreaterThan(0);
    // L'objectif clos n'apparaît qu'une fois : dans « Terminés cette
    // semaine », pas dans la liste des objectifs en cours.
    expect(screen.getAllByText('Échu hier')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Échu hier, / })).toBeTruthy();
    // Badges : lus par leur libellé parlé (voir StatusBadge).
    expect(screen.getAllByLabelText(i18n.t('statusSpoken.exceeded')).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(i18n.t('statusSpoken.late')).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(i18n.t('statusSpoken.failed'))).toHaveLength(1);
  });
});

describe('WeeklyScreen — terminés cette semaine', () => {
  const TITLE = () => i18n.t('weekly.closedThisWeek');

  // Échéance à `deadlineOffset` jours de la date d'exécution (négatif =
  // passé), cible 100, total `total`.
  function goal(id: string, deadlineOffset: number, total: number): Goal {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - 30);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineOffset);
    return {
      id,
      title: `Objectif ${id}`,
      targetValue: 100,
      unit: 'reps',
      createdAt: createdAt.toISOString(),
      deadline: deadline.toISOString(),
      entries: [{ date: '2026-08-01', value: total }],
    };
  }

  function flatStyle(element: { props: { style?: unknown } }) {
    const style = element.props.style;
    return Array.isArray(style) ? Object.assign({}, ...style.flat().filter(Boolean)) : style;
  }

  const row = (id: string) => screen.getByRole('button', { name: new RegExp(`^Objectif ${id}, `) });

  it("n'affiche pas la carte quand rien n'a été clos dans la semaine", async () => {
    await renderWeekly([goal('ouvert', 5, 20), goal('ancien', -10, 20)]);

    expect(screen.queryByText(TITLE())).toBeNull();
  });

  it('garde la carte quand tous les objectifs sont clos, sans liste en cours', async () => {
    await renderWeekly([goal('a', -1, 40), goal('b', -3, 100)]);

    expect(screen.getByText(TITLE())).toBeTruthy();
    expect(screen.queryByText(i18n.t('weekly.activeGoals'))).toBeNull();
    expect(row('a')).toBeTruthy();
    expect(row('b')).toBeTruthy();
  });

  it('borde les lignes dépassées et manquées de la couleur de leur statut, pas les atteintes', async () => {
    await renderWeekly([
      goal('exceeded', -1, 150),
      goal('failed', -2, 40),
      goal('reached', -3, 100),
    ]);

    expect(flatStyle(row('exceeded'))).toMatchObject({
      borderLeftWidth: 3,
      borderLeftColor: statusColors.exceeded.text,
    });
    expect(flatStyle(row('failed'))).toMatchObject({
      borderLeftWidth: 3,
      borderLeftColor: statusColors.failed.text,
    });
    expect(flatStyle(row('reached')).borderLeftWidth).toBeUndefined();
  });

  it("ouvre le détail de l'objectif à l'appui", async () => {
    await renderWeekly([goal('clos', -1, 40)]);

    fireEvent.press(row('clos'));

    expect(router.push).toHaveBeenCalledWith('/goal/clos');
  });

  it('annonce titre, progression finale et statut parlé, sans symbole', async () => {
    await renderWeekly([goal('depasse', -1, 150), goal('atteint', -2, 100)]);

    expect(row('depasse').props.accessibilityLabel).toBe(
      [
        'Objectif depasse',
        i18n.t('goalCard.progressA11y', { percent: 150 }),
        i18n.t('statusSpoken.exceeded'),
      ].join(', '),
    );
    expect(row('atteint').props.accessibilityLabel).not.toMatch(/[✓★]/);
    expect(row('depasse').props.accessibilityLabel).not.toMatch(/[✓★]/);
  });
});

describe('WeeklyScreen — graphique « séances par jour »', () => {
  // L4-03 — le graphique de cet écran est la seule représentation de cette
  // donnée (contrairement à celui de l'écran Détail, doublé par la liste
  // d'historique juste en dessous et masqué exprès au lecteur d'écran depuis
  // le test terrain du 02/09). Il doit donc s'annoncer, et en un seul
  // élément : le motif retenu partout dans ce dépôt après tests terrain
  // (GoalCard, cartes En cours/Total, GoalFields) est de fusionner les
  // fragments d'une même unité de sens.
  //
  // Portée : ce test vérifie l'attribut, pas ce qu'un lecteur d'écran
  // prononce.
  it('exposes the chart as a single accessible element carrying a composite label', async () => {
    await renderWeekly([avanceMaisEnRetard()]);

    const chart = screen.getByLabelText(new RegExp(i18n.t('weekly.sessionsPerDay')));

    expect(chart.props.accessible).toBe(true);
    // Les sept jours de la fenêtre sont nommés dans le libellé.
    expect(chart.props.accessibilityLabel.split(',').length).toBeGreaterThanOrEqual(7);
  });
});
