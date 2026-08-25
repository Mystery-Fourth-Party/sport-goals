import { Alert, Platform } from 'react-native';

interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  // Défaut 'Supprimer' : la plupart des call sites sont des suppressions
  // (handleDelete/handleDeleteEntry) — DataSection.confirmAndImport passe
  // 'Importer' explicitement.
  confirmLabel?: string;
  onConfirm: () => void;
}

// Factorise le pattern Alert.alert / window.confirm dupliqué à l'identique
// dans DataSection.confirmAndImport et app/goal/[id].tsx (handleDelete,
// handleDeleteEntry). Format web volontairement "title\n\nmessage" (déjà
// celui de DataSection) : les deux call sites de goal/[id].tsx passaient
// jusqu'ici une unique chaîne fusionnée, désormais alignés dessus.
export function confirmDestructive({
  title,
  message,
  confirmLabel = 'Supprimer',
  onConfirm,
}: ConfirmDestructiveOptions): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
