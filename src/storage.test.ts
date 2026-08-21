import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadGoals, saveGoals } from './storage';
import { Goal } from './types';

const GOALS_KEY = 'goals';

const goal: Goal = {
  id: '1',
  title: 'Pompes',
  targetValue: 100,
  currentValue: 20,
  unit: 'reps',
  createdAt: '2026-01-01T00:00:00.000Z',
  deadline: '2026-02-01T00:00:00.000Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('loadGoals', () => {
  it('returns an empty array when nothing is stored', async () => {
    await expect(loadGoals()).resolves.toEqual([]);
  });

  it('returns the goals previously saved', async () => {
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify([goal]));

    await expect(loadGoals()).resolves.toEqual([goal]);
  });

  it('falls back to an empty array when the stored JSON is corrupted', async () => {
    await AsyncStorage.setItem(GOALS_KEY, '{not valid json');

    await expect(loadGoals()).resolves.toEqual([]);
  });

  it('falls back to an empty array when reading from storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));

    await expect(loadGoals()).resolves.toEqual([]);
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
