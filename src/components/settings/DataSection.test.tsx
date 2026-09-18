// L4-04 — les deux lignes « Exporter »/« Importer » sont des Pressable avec
// accessibilityRole="button" mais sans accessibilityLabel : le chevron « › »
// qu'elles rendent se retrouvait dans ce que le lecteur d'écran annonce.
// Même motif que la carte « Terminés » de app/index.tsx, où le chevron avait
// déjà été écarté par un libellé explicite.
//
// Portée de ces tests : ils vérifient que l'attribut existe, pas ce qu'un
// lecteur d'écran prononce — RNTL ne modélise pas la concaténation des
// enfants. Le symptôme se constate sur appareil ; ces tests épinglent le
// mécanisme qui le corrige.
import { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import DataSection from './DataSection';
import { GoalsProvider } from '../../goals-context';
import i18n from '../../i18n';
import { SettingsProvider } from '../../settings-context';
import { StorageStatusProvider } from '../../storage-status';

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
