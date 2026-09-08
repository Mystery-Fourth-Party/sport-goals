import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { cancelDailyReminder, rescheduleDailyReminder } from './notifications';
import ReminderScheduler from './ReminderScheduler';
import { ReminderStatusProvider, useReminderStatus } from './reminder-status';
import { DEFAULT_SETTINGS, Settings } from './settingsStorage';
import { Goal } from './types';

// cancelDailyReminder/rescheduleDailyReminder touchent expo-notifications
// (orchestration native) — mockées pour n'observer que la décision de
// ReminderScheduler, pas leur exécution réelle (déjà hors scope de tests
// unitaires, voir notifications.ts). jest.mock est hoisté au-dessus des
// imports par babel-jest, donc sûr même si ça se lit comme venant "après"
// l'import ci-dessus.
jest.mock('./notifications', () => ({
  // Résout : les vraies fonctions sont async et le composant chaîne un
  // .catch() dessus depuis l'activation de no-floating-promises. Un
  // jest.fn() nu renverrait undefined et ferait planter l'effet.
  // rescheduleDailyReminder reçoit sa valeur par test (mockResolvedValue),
  // cancelDailyReminder garde ce défaut (mockClear ne l'efface pas).
  cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
  rescheduleDailyReminder: jest.fn(),
}));

// useGoals/useSettings mockées directement plutôt que rendues via leurs
// vrais providers (AsyncStorage) : ce composant ne teste que sa réaction à
// goals/settings, pas leur chargement. Variables de module mutées par
// chaque test puis relues à chaque rendu — voir wrapper/rerender ci-dessous.
let mockGoals: Goal[] = [];
let mockGoalsLoaded = true;
let mockSettings: Settings = DEFAULT_SETTINGS;
let mockSettingsLoaded = true;

jest.mock('./goals-context', () => ({
  useGoals: () => ({ goals: mockGoals, loaded: mockGoalsLoaded }),
}));
jest.mock('./settings-context', () => ({
  useSettings: () => ({ settings: mockSettings, loaded: mockSettingsLoaded }),
}));

const mockedCancel = cancelDailyReminder as jest.Mock;
const mockedReschedule = rescheduleDailyReminder as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ReminderStatusProvider>
      <ReminderScheduler />
      {children}
    </ReminderStatusProvider>
  );
}

function renderStatus() {
  return renderHook(() => useReminderStatus(), { wrapper });
}

beforeEach(() => {
  mockedCancel.mockClear();
  mockedReschedule.mockReset();
  mockGoals = [];
  mockGoalsLoaded = true;
  mockSettings = DEFAULT_SETTINGS;
  mockSettingsLoaded = true;
});

it('cancels and never reschedules when dailyReminder is false, status stays undefined', () => {
  mockSettings = { ...DEFAULT_SETTINGS, dailyReminder: false };

  const { result } = renderStatus();

  expect(mockedCancel).toHaveBeenCalledTimes(1);
  expect(mockedReschedule).not.toHaveBeenCalled();
  expect(result.current.error).toBeUndefined();
});

it('reschedules and clears any prior status when dailyReminder is true and it succeeds', async () => {
  mockSettings = { ...DEFAULT_SETTINGS, dailyReminder: true };
  mockedReschedule.mockResolvedValue({ ok: true });

  const { result } = renderStatus();

  await waitFor(() => expect(mockedReschedule).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.error).toBeUndefined());
});

it('surfaces the error when rescheduling fails', async () => {
  mockSettings = { ...DEFAULT_SETTINGS, dailyReminder: true };
  mockedReschedule.mockResolvedValue({ ok: false, error: 'Notifications non autorisées.' });

  const { result } = renderStatus();

  await waitFor(() => expect(result.current.error).toBe('Notifications non autorisées.'));
});

it('applies the result of the most recently triggered run, not the most recently resolved one', async () => {
  mockSettings = { ...DEFAULT_SETTINGS, dailyReminder: true, reminderTime: '08:00' };

  let resolveFirst: (r: { ok: boolean; error?: string }) => void = () => {};
  let resolveSecond: (r: { ok: boolean; error?: string }) => void = () => {};
  mockedReschedule
    .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

  const { result, rerender } = renderStatus();
  expect(mockedReschedule).toHaveBeenCalledTimes(1);

  // Change une dépendance pertinente de l'effet (reminderTime) avant que la
  // 1re promesse ne se résolve : 2e exécution, elle aussi en attente.
  mockSettings = { ...mockSettings, reminderTime: '09:00' };
  rerender({});
  expect(mockedReschedule).toHaveBeenCalledTimes(2);

  // La 2e (dernière déclenchée) résout EN PREMIER.
  act(() => resolveSecond({ ok: false, error: 'erreur de la 2e exécution' }));
  await waitFor(() => expect(result.current.error).toBe('erreur de la 2e exécution'));

  // La 1re (obsolète) résout APRÈS — ne doit pas écraser le statut déjà posé
  // par la 2e, plus récente. C'est ce que la garde "dernière requête gagne"
  // de ReminderScheduler doit empêcher.
  await act(async () => {
    resolveFirst({ ok: false, error: 'erreur de la 1re exécution (obsolète)' });
    await Promise.resolve();
  });
  expect(result.current.error).toBe('erreur de la 2e exécution');
});

// ─── Reproduction du finding L2-04 ──────────────────────────────────────
// La garde runId ne filtrait que l'affichage du statut : rien n'empêchait
// une exécution obsolète de mener son cycle annulation + programmation
// jusqu'au bout, par-dessus une exécution plus récente.

it('hands rescheduleDailyReminder a staleness probe so an outdated run can abort', () => {
  mockSettings = { ...DEFAULT_SETTINGS, dailyReminder: true };
  mockedReschedule.mockResolvedValue({ ok: true });

  renderStatus();

  expect(mockedReschedule).toHaveBeenCalledTimes(1);
  const options = mockedReschedule.mock.calls[0][4];
  expect(typeof options?.isStale).toBe('function');
  // Aucune exécution plus récente n'a eu lieu : la sonde doit dire "encore
  // valide", sans quoi la reprogrammation légitime s'interromprait.
  expect(options.isStale()).toBe(false);
});

it('reports the run as stale once a newer run has started', async () => {
  mockSettings = { ...DEFAULT_SETTINGS, dailyReminder: true };
  mockedReschedule.mockResolvedValue({ ok: true });

  const { rerender } = renderStatus();
  const firstProbe = mockedReschedule.mock.calls[0][4].isStale;

  // Un changement d'horaire relance l'effet : la sonde de la PREMIÈRE
  // exécution doit désormais se déclarer obsolète.
  mockSettings = { ...DEFAULT_SETTINGS, dailyReminder: true, reminderTime: '07:30' };
  await act(async () => {
    rerender(undefined);
  });

  expect(mockedReschedule).toHaveBeenCalledTimes(2);
  expect(firstProbe()).toBe(true);
  expect(mockedReschedule.mock.calls[1][4].isStale()).toBe(false);
});
