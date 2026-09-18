// REVUE — LOT 1 (logique pure). Preuves, pas correctifs.
//
// Ce fichier n'a pas vocation à être mergé. Il vit sur la branche
// revue/preuves-claude et sert à établir que chaque finding du lot 1 est
// réel plutôt que raisonné : chaque test échoue sur master et décrit le
// comportement attendu. Les tests rouges définitifs seront écrits au moment
// des correctifs, dans l'ordre qu'impose AGENTS.md.
//
// Base : master à 04df1f8 (merge de la PR #28).
import { render, screen, act, fireEvent } from '@testing-library/react-native';
import GoalCard from '../src/components/GoalCard';
import GoalForm from '../src/components/GoalForm';
import { buildBackupPayload } from '../src/backup';
import i18n from '../src/i18n';
import { DEFAULT_SETTINGS } from '../src/settingsStorage';
import { getGoalStats, todayStr } from '../src/stats';
import { Goal } from '../src/types';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

beforeAll(() => i18n.changeLanguage('fr'));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function dayKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── R1-01 ───────────────────────────────────────────────────────────────
// GoalCard annonce « 0 jour consécutif » comme encouragement.
//
// getGoalStats().streak vaut calcStreak(entries, today), qui rompt dès que
// le jour courant n'a pas d'entrée — c'est-à-dire toute la journée, jusqu'à
// ce que l'utilisateur enregistre. notifications.ts a rencontré exactement
// ce problème et l'a résolu en calculant le streak à la veille, avec un
// commentaire qui l'explique (buildReminderContent). Le chemin d'affichage
// n'a jamais reçu le même traitement.
//
// Le bandeau « en avance » ne se rend que sur status === 'ahead', ce qui
// n'exige rien du jour courant : un objectif largement en avance qui n'a
// pas encore été logé aujourd'hui affiche donc un encouragement à zéro.
describe('R1-01 — streak affiché à 0 sur la carte « en avance »', () => {
  const enAvanceSansEntreeAujourdhui: Goal = {
    id: 'avance',
    title: 'Objectif en avance',
    targetValue: 100,
    unit: 'reps',
    createdAt: daysFromNow(-10),
    deadline: daysFromNow(20),
    // Série de quatre jours qui s'arrête hier : rien aujourd'hui.
    entries: [
      { date: dayKey(-4), value: 20 },
      { date: dayKey(-3), value: 20 },
      { date: dayKey(-2), value: 20 },
      { date: dayKey(-1), value: 20 },
    ],
  };

  it('ne présente pas une série de 0 jour comme un encouragement', () => {
    // Précondition portée sur le statut calculé, pas sur le badge rendu :
    // StatusBadge affiche « EN AVANCE » en capitales, ce qui couplerait le
    // test à une décision de présentation sans rapport avec le finding.
    const s = getGoalStats(enAvanceSansEntreeAujourdhui, todayStr());
    expect(s.status).toBe('ahead');
    expect(s.streak).toBe(0);

    render(<GoalCard goal={enAvanceSansEntreeAujourdhui} onPress={jest.fn()} />);

    // C'est la ligne fautive : « 🔥 0 jour consécutif · en avance ».
    expect(screen.queryByText(i18n.t('goalCard.aheadHint', { count: 0 }))).toBeNull();
  });
});

// ─── R1-02 ───────────────────────────────────────────────────────────────
// fmt arrondit à zéro une exigence non nulle.
//
// fmt (stats.ts) rend une décimale pour 'km' et arrondit à l'entier pour
// 'reps', 'min' et 'h'. Toute valeur strictement comprise entre 0 et 0,5 y
// devient « 0 ». C'est le même symptôme visible que L1-02 — « 0 par jour »
// affiché alors qu'il reste du travail — mais par le formatage cette fois,
// pas par l'arithmétique, donc le correctif de PR4 ne le couvre pas.
//
// Deux sites vivants : la carte « Rythme quotidien requis » de l'écran
// Création (dailyAvg), et la colonne « Requis » de GoalProgressCard
// (dailyRequired), cette dernière rendue sans condition de statut.
describe('R1-02 — exigence non nulle affichée comme zéro', () => {
  it('ne montre pas « 0 par jour » pour un objectif de 5 répétitions en 30 jours', async () => {
    render(<GoalForm onCreate={jest.fn()} />);
    await flush();

    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.name')), 'Petit objectif');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.targetValue')), '5');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalForm.durationLabel')), '30');
    await flush();

    // 5 / 30 = 0,167 par jour. La carte annonce « ≈ 0 ».
    expect(screen.queryByText('≈ 0')).toBeNull();
  });
});

// ─── R1-03 ───────────────────────────────────────────────────────────────
// Le libellé d'unité écrit dans le fichier d'export dépend de la langue de
// l'app au moment de l'export.
//
// buildBackupPayload pose unitLabel: i18n.t(`unit.${goal.unit}`). L'en-tête
// du module annonce pourtant un format « documenté et figé pour être
// directement exploitable par un outil de traitement de données externe ».
// Un champ dont la valeur change selon la langue de l'interface n'est pas
// figé : le même objectif exporté en français puis en anglais produit deux
// fichiers différents sur ce champ, sans que rien dans le fichier ne dise
// quelle langue a été utilisée.
//
// Sans conséquence à la réimportation (parseBackupPayload ignore ce champ) :
// c'est la promesse d'exploitabilité externe qui n'est pas tenue.
describe('R1-03 — libellé d unité de l export dépendant de la langue', () => {
  const goal: Goal = {
    id: 'g1',
    title: 'Pompes',
    targetValue: 100,
    unit: 'reps',
    createdAt: daysFromNow(-10),
    deadline: daysFromNow(20),
    entries: [],
  };

  it('écrit le même libellé d unité quelle que soit la langue de l app', async () => {
    await i18n.changeLanguage('fr');
    const enFrancais = buildBackupPayload([goal], DEFAULT_SETTINGS, todayStr());

    await i18n.changeLanguage('en');
    const enAnglais = buildBackupPayload([goal], DEFAULT_SETTINGS, todayStr());

    await i18n.changeLanguage('fr');

    expect(enAnglais.goals[0].unitLabel).toBe(enFrancais.goals[0].unitLabel);
  });
});
