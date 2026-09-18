// L4-04 — le ✓ de la ligne sélectionnée était concaténé au nom de la langue
// dans le nom accessible de la ligne, faute d'accessibilityLabel explicite
// sur le Pressable. Même motif que la carte « Terminés » de app/index.tsx,
// où le chevron avait déjà été écarté de cette façon.
import { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import LanguageSection from './LanguageSection';
import i18n from '../../i18n';
import { SettingsProvider } from '../../settings-context';
import { StorageStatusProvider } from '../../storage-status';

beforeAll(() => i18n.changeLanguage('fr'));
// Portée de ces tests : ils vérifient que l'attribut existe, pas ce qu'un
// lecteur d'écran prononce. RNTL ne modélise pas la concaténation des
// enfants — interrogé par rôle et par nom, il trouve déjà « Système » alors
// que la ligne rend « Système » suivi de « ✓ ». Le symptôme réel se constate
// sur appareil ; ces tests épinglent le mécanisme qui le corrige.

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>{children}</SettingsProvider>
    </StorageStatusProvider>
  );
}

describe('LanguageSection', () => {
  it('names each row by its language alone, without the selection glyph', async () => {
    render(<LanguageSection />, { wrapper });

    await waitFor(() =>
      expect(screen.getByLabelText(i18n.t('languageSection.french'))).toBeTruthy(),
    );
    expect(screen.getByLabelText(i18n.t('languageSection.english'))).toBeTruthy();
    expect(screen.getByLabelText(i18n.t('languageSection.system'))).toBeTruthy();
  });

  // L'état sélectionné reste porté par accessibilityState, que VoiceOver et
  // TalkBack verbalisent déjà : le dupliquer dans le libellé ferait une
  // double annonce.
  it('keeps the selected state on accessibilityState rather than in the label', async () => {
    render(<LanguageSection />, { wrapper });

    const systemRow = await screen.findByLabelText(i18n.t('languageSection.system'));
    // Aucune langue stockée par défaut : « Système » est la ligne cochée.
    expect(systemRow.props.accessibilityState).toEqual({ selected: true });
    expect(
      screen.getByLabelText(i18n.t('languageSection.french')).props.accessibilityState,
    ).toEqual({ selected: false });
  });
});
