// REVUE — LOT 2 (état & persistance). Preuves, pas correctifs.
//
// Même statut que revue-lot-1.test.tsx : chaque test échoue sur master
// (04df1f8) et décrit le comportement attendu. Branche revue/preuves-claude,
// jamais destinée au merge.
//
// Avertissement d'angle mort : tout le code sondé ici est de moi (PR2 et
// PR4). R2-02 porte précisément sur une décision prise en revue de PR5 —
// conserver skipNextSave plutôt qu'une garde par référence — au motif qu'un
// test épinglerait le risque résiduel. Ce test existe et passe ; il ne
// couvre simplement pas le cas ci-dessous.
import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { GoalsProvider, useGoals } from '../src/goals-context';
import { cancelDailyReminder, rescheduleDailyReminder } from '../src/notifications';
import { ReminderStatusProvider } from '../src/reminder-status';
import ReminderScheduler from '../src/ReminderScheduler';
import { SettingsProvider } from '../src/settings-context';
import { DEFAULT_SETTINGS, loadSettings } from '../src/settingsStorage';
import { loadGoals, saveGoals } from '../src/storage';
import { StorageStatusProvider } from '../src/storage-status';
import { Goal } from '../src/types';

jest.mock('../src/notifications', () => ({
  sendGoalReachedNotification: jest.fn().mockResolvedValue(undefined),
  rescheduleDailyReminder: jest.fn().mockResolvedValue({ ok: true }),
  cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/storage', () => {
  const actual = jest.requireActual('../src/storage');
  return { ...actual, loadGoals: jest.fn(), saveGoals: jest.fn() };
});

jest.mock('../src/settingsStorage', () => {
  const actual = jest.requireActual('../src/settingsStorage');
  return { ...actual, loadSettings: jest.fn(), saveSettings: jest.fn().mockResolvedValue(true) };
});

const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;
const mockedLoadSettings = loadSettings as jest.Mock;
const mockedReschedule = rescheduleDailyReminder as jest.Mock;
const mockedCancel = cancelDailyReminder as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>{children}</GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

function makeGoal(id: string): Goal {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  return {
    id,
    title: `Objectif ${id}`,
    targetValue: 100,
    unit: 'reps',
    createdAt: '2026-09-01T12:00:00.000Z',
    deadline: deadline.toISOString(),
    entries: [],
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedLoadGoals.mockReset();
  mockedSaveGoals.mockReset().mockResolvedValue(true);
  mockedLoadSettings.mockReset().mockResolvedValue({ value: DEFAULT_SETTINGS, ok: true });
  mockedReschedule.mockClear();
  mockedCancel.mockClear();
});

// ─── R2-02 ───────────────────────────────────────────────────────────────
// Une modification faite pendant l'écriture d'un import, après un échec de
// lecture, n'est jamais écrite sur le disque.
//
// replaceAllGoals arme skipNextSave puis écrit lui-même. Quand readFailed
// est vrai, l'effet de sauvegarde retourne AVANT de consommer le drapeau
// (l'ordre des deux gardes est délibéré, voir le commentaire dans
// goals-context.tsx). Le drapeau reste donc armé pendant toute l'écriture.
//
// Si l'utilisateur modifie ses objectifs pendant ce temps, l'effet déclenché
// par cette modification retourne lui aussi sur readFailed. Puis l'écriture
// de l'import réussit, readFailed repasse à false, l'effet se redéclenche —
// et consomme le drapeau armé, sautant l'écriture de la modification.
//
// skipNextSave saute « le prochain passage de l'effet », pas « la valeur
// déjà écrite » : dès qu'un passage s'intercale, il protège la mauvaise. Le
// test « persists an ordinary import exactly once » épingle le nombre
// d'écritures par import, pas ce cas-ci.
describe('R2-02 — écriture perdue après un import sur échec de lecture', () => {
  it('écrit une progression ajoutée pendant que l import est en cours', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [], ok: false });

    // Écriture de l'import laissée en suspens, pour intercaler une action
    // utilisateur avant sa résolution.
    let resolveImportWrite!: (ok: boolean) => void;
    mockedSaveGoals.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveImportWrite = resolve;
      }),
    );

    const { result } = renderHook(() => useGoals(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.replaceAllGoals([makeGoal('importe')]));

    // L'utilisateur ajoute un objectif pendant que l'import s'écrit.
    act(() => result.current.createGoal(makeGoal('ajoute-pendant-import')));
    await act(async () => {});

    // L'écriture de l'import aboutit : readFailed retombe, les sauvegardes
    // automatiques reprennent.
    await act(async () => {
      resolveImportWrite(true);
    });
    await act(async () => {});

    expect(result.current.goals.map((g) => g.id)).toEqual(['ajoute-pendant-import', 'importe']);

    // Le disque doit contenir les deux. Aujourd'hui la seule écriture est
    // celle de l'import : l'objectif ajouté n'atteint jamais le stockage et
    // disparaît au prochain démarrage.
    const ecrit = mockedSaveGoals.mock.calls.map((call) => (call[0] as Goal[]).map((g) => g.id));
    expect(ecrit).toContainEqual(['ajoute-pendant-import', 'importe']);
  });
});

// ─── R2-01 ───────────────────────────────────────────────────────────────
// Le contenu du rappel quotidien n'est pas régénéré au passage de minuit.
//
// notifications.ts affirme : « Le contenu [...] est régénéré à chaque appel
// de cette fonction, c'est-à-dire à chaque fois que l'app tourne (voir
// ReminderScheduler). » L'effet de ReminderScheduler ne dépend pourtant que
// de goals, des trois réglages concernés, des deux drapeaux loaded et de la
// langue — jamais du jour. Il ne se redéclenche donc pas quand l'app revient
// au premier plan un jour plus tard sans qu'aucun état n'ait changé.
//
// PR4 a posé useToday pour exactement ce problème côté affichage, en
// réservant todayStr() aux actions qui horodatent. Le planificateur appelle
// todayStr() dans son effet : la valeur est juste quand l'effet tourne, mais
// rien ne le fait tourner à minuit.
//
// Conséquence : la variante « série en danger » reste celle de la veille —
// elle peut nommer un objectif désormais complété, ou annoncer un compte de
// jours périmé, jusqu'à la prochaine action de l'utilisateur.
describe('R2-01 — rappel quotidien non régénéré au changement de jour', () => {
  it('reprogramme le rappel quand l application revient au premier plan un jour plus tard', async () => {
    mockedLoadGoals.mockResolvedValue({ value: [makeGoal('g1')], ok: true });
    mockedLoadSettings.mockResolvedValue({
      value: {
        dailyReminder: true,
        reminderTime: '20:00',
        goalReachedNotifs: false,
        almostThereNotifs: true,
        streakAlert: true,
      },
      ok: true,
    });

    // Capture le gestionnaire AppState, celui-là même auquel useToday
    // s'abonne : c'est le signal « l'utilisateur revient sur l'app ».
    let fireAppState: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'change') fireAppState = cb as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
    });

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 20, 23, 50));

    render(
      <StorageStatusProvider>
        <SettingsProvider>
          <GoalsProvider>
            <ReminderStatusProvider>
              <ReminderScheduler />
            </ReminderStatusProvider>
          </GoalsProvider>
        </SettingsProvider>
      </StorageStatusProvider>,
    );

    await waitFor(() => expect(mockedReschedule).toHaveBeenCalled());
    expect(mockedReschedule.mock.calls.at(-1)?.[1]).toBe('2026-09-20');
    const appelsAvant = mockedReschedule.mock.calls.length;

    // Minuit passe pendant que l'app est en arrière-plan, puis l'utilisateur
    // la rouvre — sans rien modifier.
    jest.setSystemTime(new Date(2026, 8, 21, 8, 30));
    await act(async () => {
      fireAppState?.('active');
    });

    expect(mockedReschedule.mock.calls.length).toBeGreaterThan(appelsAvant);
    expect(mockedReschedule.mock.calls.at(-1)?.[1]).toBe('2026-09-21');

    jest.useRealTimers();
  });
});
