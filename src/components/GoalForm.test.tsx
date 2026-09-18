// L4-01 — t('goalForm.perDay', { unit }) recevait la clé technique de
// l'unité ('reps', 'km') au lieu de son libellé traduit, alors que la clé
// vaut « {{unit}} par jour ». Rendu : « reps par jour ».
//
// C'est la troisième fois que ce motif échappe à une correction : le tri
// citait trois sites, un avait déjà été corrigé en PR #17, et les deux
// restants n'ont été retrouvés qu'en croisant les clés interpolant
// {{unit}} avec leurs appels. Les dix autres sites du dépôt passent bien
// t('unit.…') ou t('unitSpoken.…').
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import GoalForm from './GoalForm';
import i18n from '../i18n';

beforeAll(() => i18n.changeLanguage('fr'));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// Purge les animations du Toggle rendu par GoalFields (Animated.timing,
// 200 ms) : sans ça leurs mises à jour d'état tombent hors de act() et
// React les signale bruyamment. Même helper que
// __tests__/goal-edit-screen.test.tsx.
async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

describe('GoalForm', () => {
  // La carte « rythme quotidien » n'apparaît qu'une fois la cible et la
  // durée saisies (dailyAvg > 0).
  async function fillForm() {
    render(<GoalForm onCreate={jest.fn()} />);
    await flush();

    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.name')), 'Pompes');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.targetValue')), '100');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalForm.durationLabel')), '10');
    await flush();
  }

  it('spells out the unit rather than showing its technical key', async () => {
    await fillForm();

    // Assertion volontairement dans cet ordre : c'est l'absence de la clé
    // brute qui montre le symptôme, la présence du libellé traduit qui
    // montre le correctif.
    expect(screen.queryByText(i18n.t('goalForm.perDay', { unit: 'reps' }))).toBeNull();
    expect(screen.getByText(i18n.t('goalForm.perDay', { unit: i18n.t('unit.reps') }))).toBeTruthy();
  });
});
