import { Alert, Platform } from 'react-native';
import i18n from './i18n';

interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  // Défaut common.delete ('Supprimer') : la plupart des call sites sont des
  // suppressions (handleDelete/handleDeleteEntry) — DataSection.
  // confirmAndImport passe common.import ('Importer') explicitement.
  confirmLabel?: string;
  onConfirm: () => void;
}

// Pattern Alert.alert / window.confirm partagé par DataSection.confirmAndImport
// et app/goal/[id].tsx (handleDelete, handleDeleteEntry). Format web
// volontairement "title\n\nmessage" (celui de DataSection) : les call sites
// de goal/[id].tsx passent title et message séparément, comme DataSection,
// et non une unique chaîne fusionnée.
// title/message restent la responsabilité de chaque appelant (déjà traduits
// là où ils sont construits) ; seul le chrome de l'alerte (bouton Annuler,
// libellé de confirmation par défaut) est traduit ici, fonction pure hors
// composant comme statusLabel (stats.ts) et dateLabels.ts.
export function confirmDestructive({
  title,
  message,
  confirmLabel = i18n.t('common.delete'),
  onConfirm,
}: ConfirmDestructiveOptions): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
