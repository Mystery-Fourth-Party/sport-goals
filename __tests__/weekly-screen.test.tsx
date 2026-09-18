// L3-03 et L4-03, écran Résumé hebdomadaire.
//
// Placé ici et non à côté de app/weekly.tsx : le require.context
// d'expo-router n'exclut que les fichiers `+api` et `+html`, donc tout autre
// fichier de app/ devient une route (voir goal-edit-screen.test.tsx).
import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
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
// en retard sur son propre rythme attendu : son échéance est passée. C'est
// exactement le cas que la couleur verte codée en dur rendait trompeur.
function avanceMaisEnRetard(): Goal {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - 30);
  const deadline = new Date();
  deadline.setDate(deadline.getDate() - 1);
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
