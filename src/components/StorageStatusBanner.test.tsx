import { ReactNode } from 'react';
import { act, renderHook, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StorageStatusBanner from './StorageStatusBanner';
// Initialise l'instance i18next partagée : le bandeau lit ses textes via
// useTranslation, qui renverrait les clés brutes sans cet import. Les
// attentes passent par i18n.t plutôt que par des chaînes en dur : la langue
// retenue sous jest dépend de la locale détectée, et ce qu'on veut vérifier
// ici est la clé choisie (lecture ou écriture), pas la copie elle-même.
import i18n from '../i18n';
import { StorageStatusProvider, useStorageStatus } from '../storage-status';

// Métriques fournies à la main : sans SafeAreaProvider renseigné,
// useSafeAreaInsets (utilisé par le bandeau pour passer sous l'encoche) n'a
// aucune valeur à lire sous jest.
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Le bandeau est rendu à côté du hook plutôt que capturé depuis l'intérieur
// d'un composant : le test pilote le contexte par result.current, comme le
// feraient GoalsProvider/SettingsProvider, et lit l'arbre par `screen`.
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <StorageStatusProvider>
        {children}
        <StorageStatusBanner />
      </StorageStatusProvider>
    </SafeAreaProvider>
  );
}

function renderBanner() {
  return renderHook(() => useStorageStatus(), { wrapper });
}

const READ_MESSAGE = i18n.t('storage.loadFailed');
const WRITE_MESSAGE = i18n.t('storage.saveFailed');

describe('StorageStatusBanner', () => {
  it('renders nothing while both reads and writes are fine', () => {
    renderBanner();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces a read failure as an alert', () => {
    const { result } = renderBanner();

    act(() => result.current.reportLoadResult('goals', false));

    expect(screen.getByRole('alert')).toHaveTextContent(READ_MESSAGE);
  });

  it('announces a write failure', () => {
    const { result } = renderBanner();

    act(() => result.current.reportSaveResult('settings', false));

    expect(screen.getByRole('alert')).toHaveTextContent(WRITE_MESSAGE);
  });

  // Une lecture en échec bloque déjà toute écriture (voir goals-context.tsx) :
  // annoncer « ta dernière modification n'a pas pu être enregistrée »
  // par-dessus serait redondant, et moins actionnable que « ferme et rouvre
  // l'app ».
  it('keeps the read-failure message when a write fails too', () => {
    const { result } = renderBanner();

    act(() => {
      result.current.reportLoadResult('goals', false);
      result.current.reportSaveResult('goals', false);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(READ_MESSAGE);
    expect(screen.queryByText(WRITE_MESSAGE)).toBeNull();
  });

  it('goes away once a later write succeeds', () => {
    const { result } = renderBanner();
    act(() => result.current.reportSaveResult('goals', false));
    expect(screen.getByRole('alert')).toBeTruthy();

    act(() => result.current.reportSaveResult('goals', true));

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
