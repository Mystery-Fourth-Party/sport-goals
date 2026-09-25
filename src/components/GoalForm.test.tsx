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
import { MAX_GOAL_DAYS } from '../goalValidation';
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

  // R2 — même trou qu'à l'édition : `Number(x) > 0` laisse passer
  // Infinity, que Number('1e400') produit.
  it('refuses a target value that overflows to Infinity', async () => {
    const onCreate = jest.fn();
    render(<GoalForm onCreate={onCreate} />);
    await flush();

    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.name')), 'Pompes');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.targetValue')), '1e400');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalForm.durationLabel')), '10');
    fireEvent.press(screen.getByText(i18n.t('goalForm.submit')));
    await flush();

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t('goalForm.targetPositive'))).toBeTruthy();
  });

  // Une durée entière mais démesurée passe parseDurationDays : setDate
  // pousse alors l'échéance hors de la plage des dates JS, et toISOString
  // lève une RangeError au milieu de handleSubmit.
  it('refuses a duration too large to produce a valid deadline, without crashing', async () => {
    const onCreate = jest.fn();
    render(<GoalForm onCreate={onCreate} />);
    await flush();

    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.name')), 'Pompes');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.targetValue')), '100');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalForm.durationLabel')), '1000000000');
    expect(() => fireEvent.press(screen.getByText(i18n.t('goalForm.submit')))).not.toThrow();
    await flush();

    expect(onCreate).not.toHaveBeenCalled();
  });

  async function submitWithDuration(duration: string) {
    const onCreate = jest.fn();
    render(<GoalForm onCreate={onCreate} />);
    await flush();
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.name')), 'Pompes');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.targetValue')), '100');
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalForm.durationLabel')), duration);
    fireEvent.press(screen.getByText(i18n.t('goalForm.submit')));
    await flush();
    return onCreate;
  }

  describe('continuer le rappel une fois atteint', () => {
    const LABEL = () => i18n.t('goalFields.remindAfterReached');

    it('is off by default and saved as false', async () => {
      const onCreate = await submitWithDuration('10');
      expect(onCreate.mock.calls[0][0].remindAfterReached).toBe(false);
    });

    it('is saved as true once switched on', async () => {
      const onCreate = jest.fn();
      render(<GoalForm onCreate={onCreate} />);
      await flush();
      fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.name')), 'Pompes');
      fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.targetValue')), '100');
      fireEvent.changeText(screen.getByLabelText(i18n.t('goalForm.durationLabel')), '10');
      fireEvent.press(screen.getByLabelText(LABEL()));
      fireEvent.press(screen.getByText(i18n.t('goalForm.submit')));
      await flush();

      expect(onCreate.mock.calls[0][0].remindAfterReached).toBe(true);
    });

    // reminderEnabled === false l'emporte : l'interrupteur n'aurait aucun effet.
    it('is hidden while the goal reminders are off', async () => {
      render(<GoalForm onCreate={jest.fn()} />);
      await flush();
      expect(screen.getByLabelText(LABEL())).toBeTruthy();

      fireEvent.press(screen.getByLabelText(i18n.t('goalFields.remindersEnabled')));
      await flush();
      expect(screen.queryByLabelText(LABEL())).toBeNull();
    });
  });

  it('accepts a duration of exactly the maximum', async () => {
    const onCreate = await submitWithDuration(String(MAX_GOAL_DAYS));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('refuses one day over the maximum, with a message naming the limit', async () => {
    const onCreate = await submitWithDuration(String(MAX_GOAL_DAYS + 1));
    expect(onCreate).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t('goalForm.durationTooLong', { max: MAX_GOAL_DAYS })),
    ).toBeTruthy();
  });
});
