import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadGoals, saveGoals } from './storage';
import { Goal } from './types';

const GOALS_KEY = 'goals';

const goal: Goal = {
  id: '1',
  title: 'Pompes',
  targetValue: 100,
  unit: 'reps',
  createdAt: '2026-01-01T00:00:00.000Z',
  deadline: '2026-02-01T00:00:00.000Z',
  entries: [{ date: '2026-01-01', value: 20 }],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('loadGoals', () => {
  // `ok` est ce qui sépare les deux replis sur [] : « rien de stocké », qui
  // est une réponse légitime, et « lecture impossible », où le disque
  // contient peut-être encore les objectifs de l'utilisateur. Les deux
  // renvoyaient la même valeur nue, indistinguables pour l'appelant.
  it('returns an empty array with ok: true when nothing is stored', async () => {
    await expect(loadGoals()).resolves.toEqual({ value: [], ok: true });
  });

  it('returns the goals previously saved with ok: true', async () => {
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify([goal]));

    await expect(loadGoals()).resolves.toEqual({ value: [goal], ok: true });
  });

  it('reports ok: false when the stored JSON is corrupted', async () => {
    await AsyncStorage.setItem(GOALS_KEY, '{not valid json');

    await expect(loadGoals()).resolves.toEqual({ value: [], ok: false });
  });

  it('reports ok: false when reading from storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));

    await expect(loadGoals()).resolves.toEqual({ value: [], ok: false });
  });

  it('defaults entries to [] for legacy goals saved without that field', async () => {
    const { entries, ...legacyGoal } = goal;
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify([legacyGoal]));

    const { value } = await loadGoals();

    expect(value).toEqual([{ ...legacyGoal, entries: [] }]);
  });
});

describe('saveGoals', () => {
  it('persists the goals and returns true on success', async () => {
    await expect(saveGoals([goal])).resolves.toBe(true);

    const raw = await AsyncStorage.getItem(GOALS_KEY);
    expect(JSON.parse(raw as string)).toEqual([goal]);
  });

  it('returns false and does not throw when writing fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('write failed'));

    await expect(saveGoals([goal])).resolves.toBe(false);
  });
});
