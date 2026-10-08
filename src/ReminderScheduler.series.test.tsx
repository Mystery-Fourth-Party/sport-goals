// Rappel d'une série qui se répète : l'occurrence créée à la réouverture est
// prise en compte par le vrai ReminderScheduler le jour même, selon ses propres
// réglages. Monte les vrais providers (objectifs, réglages) et n'observe que
// les appels à expo-notifications. Ne couvre pas la création elle-même, qui
// est dans goals-context.series.test.tsx.
import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { GoalsProvider } from './goals-context';
import { ReminderStatusProvider } from './reminder-status';
import ReminderScheduler from './ReminderScheduler';
import { SettingsProvider } from './settings-context';
import { DEFAULT_SETTINGS } from './settingsStorage';
import { StorageStatusProvider } from './storage-status';
import { Goal } from './types';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
}));

const mockedSchedule = Notifications.scheduleNotificationAsync as jest.Mock;

function Tree({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>
          <ReminderStatusProvider>{children}</ReminderStatusProvider>
        </GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

function scheduledTimes(): string[] {
  return mockedSchedule.mock.calls
    .filter(([request]) => request.trigger !== null)
    .map(([request]) => {
      const { hour, minute } = request.trigger;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });
}

// Série dont la dernière occurrence s'est terminée le 14/10, horaire
// personnalisé 07:30 : seule l'occurrence créée peut encore faire programmer
// ce créneau, l'ancienne étant close.
function closedOccurrence(): Goal {
  return {
    id: 'tip',
    title: 'Courir 100 km',
    targetValue: 100,
    unit: 'km',
    createdAt: new Date(2026, 8, 14, 12).toISOString(),
    deadline: new Date(2026, 9, 14, 12).toISOString(),
    entries: [],
    reminderTime: '07:30',
    repeat: true,
    seriesId: 's1',
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('goals', JSON.stringify([closedOccurrence()]));
  await AsyncStorage.setItem(
    'settings',
    JSON.stringify({ ...DEFAULT_SETTINGS, dailyReminder: true, reminderTime: '20:00' }),
  );
  mockedSchedule.mockClear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 15, 9, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ReminderScheduler — occurrence créée par la répétition', () => {
  it('schedules the new occurrence on the day it is created, at its own reminder time', async () => {
    render(
      <Tree>
        <ReminderScheduler />
      </Tree>,
    );

    await waitFor(() => expect(scheduledTimes()).toContain('07:30'));
  });

  it('sends no immediate notification when the occurrence is created', async () => {
    render(
      <Tree>
        <ReminderScheduler />
      </Tree>,
    );
    await waitFor(() => expect(scheduledTimes()).toContain('07:30'));

    const immediate = mockedSchedule.mock.calls.filter(([request]) => request.trigger === null);
    expect(immediate).toEqual([]);
  });
});
