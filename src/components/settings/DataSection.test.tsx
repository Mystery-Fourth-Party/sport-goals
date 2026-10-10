// L4-04 — les deux lignes « Exporter »/« Importer » sont des Pressable avec
// accessibilityRole="button" mais sans accessibilityLabel : le chevron « › »
// qu'elles rendent se retrouvait dans ce que le lecteur d'écran annonce.
// Même motif que la carte « Archivés » de app/index.tsx, où le chevron avait
// déjà été écarté par un libellé explicite.
//
// Portée de ces tests : ils vérifient que l'attribut existe, pas ce qu'un
// lecteur d'écran prononce — RNTL ne modélise pas la concaténation des
// enfants. Le symptôme se constate sur appareil ; ces tests épinglent le
// mécanisme qui le corrige.
import { ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import DataSection from './DataSection';
import { buildBackupPayload } from '../../backup';
import { GoalsProvider } from '../../goals-context';
import i18n from '../../i18n';
import { SettingsProvider } from '../../settings-context';
import { StorageStatusProvider } from '../../storage-status';

// Le contenu du « fichier choisi », lu par le faux File ci-dessous.
let mockPickedFileText = '';
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: '' },
  File: class {
    text() {
      return Promise.resolve(mockPickedFileText);
    }
  },
}));

beforeAll(() => i18n.changeLanguage('fr'));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>{children}</GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

// Titre et sous-titre fusionnés en un seul libellé, comme le fait déjà
// rowA11yLabel dans NotificationsSection : sans ça le lecteur d'écran
// annonce la ligne en fragments séparés, chevron compris.
function rowLabel(key: string): string {
  return `${i18n.t(`data.${key}Title`)}, ${i18n.t(`data.${key}Subtitle`)}`;
}

describe('DataSection', () => {
  it('names the export row by its title and subtitle, without the chevron', async () => {
    render(<DataSection />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText(rowLabel('export'))).toBeTruthy());
  });

  it('names the import row by its title and subtitle, without the chevron', async () => {
    render(<DataSection />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText(rowLabel('import'))).toBeTruthy());
  });
});

// Parcours d'import complet : sélection du fichier, confirmation, puis ce
// qui atteint le disque. Le stockage est celui d'AsyncStorage (mock de
// jest.setup.js), lu directement : c'est lui, pas l'état React, qui dit ce
// qu'un redémarrage retrouverait.
describe('DataSection — import d’une sauvegarde', () => {
  // Réglages de l'appareil, tous différents de ceux du fichier ci-dessous.
  const deviceSettings = {
    dailyReminder: false,
    reminderTime: '20:00',
    goalReachedNotifs: true,
    almostThereNotifs: false,
    streakAlert: false,
    language: 'fr',
  };
  const deviceGoal = {
    id: 'device-goal',
    title: 'Objectif de l’appareil',
    targetValue: 10,
    unit: 'reps' as const,
    createdAt: '2026-08-01T00:00:00.000Z',
    deadline: '2026-08-31T00:00:00.000Z',
    entries: [],
  };
  const fileGoal = { ...deviceGoal, id: 'file-goal', title: 'Objectif du fichier' };

  // Ancienne sauvegarde : les six réglages, avec une langue différente.
  const olderSettings = {
    dailyReminder: true,
    reminderTime: '07:00',
    goalReachedNotifs: false,
    almostThereNotifs: true,
    streakAlert: true,
    language: 'en',
  };

  // Fonctions jest.fn du mock d'AsyncStorage, pilotées directement : un spyOn
  // posé dessus puis restauré par restoreAllMocks provoque une récursion.
  const getItemMock = AsyncStorage.getItem as jest.Mock;
  const setItemMock = AsyncStorage.setItem as jest.Mock;
  const realGetItem = getItemMock.getMockImplementation() as (
    key: string,
  ) => Promise<string | null>;
  let alertSpy: jest.SpyInstance;

  function settingsWrites() {
    return setItemMock.mock.calls.filter(([key]) => key === 'settings');
  }

  function chooseFile(settings: unknown) {
    const payload = buildBackupPayload([fileGoal], deviceSettings as never, '2026-08-20');
    mockPickedFileText = JSON.stringify({ ...payload, settings });
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///sauvegarde.json' }],
    });
  }

  async function importFile() {
    render(<DataSection />, { wrapper });
    await act(async () => {});
    fireEvent.press(screen.getByLabelText(rowLabel('import')));
  }

  async function stored(key: string) {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('settings', JSON.stringify(deviceSettings));
    await AsyncStorage.setItem('goals', JSON.stringify([deviceGoal]));
    setItemMock.mockClear();
    // Confirme d'office la boîte « Remplacer tes objectifs ? ».
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    getItemMock.mockImplementation(realGetItem);
  });

  it('replaces the goals but applies only the reminder and its time', async () => {
    chooseFile(olderSettings);

    await importFile();

    await waitFor(async () => {
      expect((await stored('goals')).map((g: { id: string }) => g.id)).toEqual(['file-goal']);
    });
    expect(await stored('settings')).toEqual({
      ...deviceSettings,
      dailyReminder: true,
      reminderTime: '07:00',
    });
  });

  it('merges onto the stored settings when the startup read failed but the re-read succeeds', async () => {
    let settingsReads = 0;
    getItemMock.mockImplementation(async (key: string) => {
      if (key === 'settings' && settingsReads++ === 0) throw new Error('lecture impossible');
      return realGetItem(key);
    });
    chooseFile(olderSettings);

    await importFile();

    await waitFor(async () => {
      expect(await stored('settings')).toEqual({
        ...deviceSettings,
        dailyReminder: true,
        reminderTime: '07:00',
      });
    });
  });

  it('imports the goals but leaves the settings untouched and says so when the re-read fails', async () => {
    getItemMock.mockImplementation(async (key: string) => {
      if (key === 'settings') throw new Error('lecture impossible');
      return realGetItem(key);
    });
    chooseFile(olderSettings);

    await importFile();

    await waitFor(() => expect(screen.getByText(i18n.t('data.reminderNotRestored'))).toBeTruthy());
    expect((await stored('goals')).map((g: { id: string }) => g.id)).toEqual(['file-goal']);
    expect(settingsWrites()).toEqual([]);
  });

  it('accepts a settings object with no usable key without writing or reporting anything', async () => {
    chooseFile({ language: 'en', streakAlert: true });

    await importFile();

    await waitFor(async () => {
      expect((await stored('goals')).map((g: { id: string }) => g.id)).toEqual(['file-goal']);
    });
    expect(settingsWrites()).toEqual([]);
    expect(screen.queryByText(i18n.t('data.reminderNotRestored'))).toBeNull();
  });
});
