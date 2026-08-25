import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { longDateLabel } from '../../dateLabels';
import { fmt, parseDate } from '../../stats';
import { colors, fontFamily, radius, white } from '../../theme';
import { Entry, Unit, UNIT_LABELS } from '../../types';

interface Props {
  mode: 'add' | 'edit' | null;
  date: string;
  value: string;
  error: boolean;
  unit: Unit;
  todayEntry: Entry | undefined;
  onChangeValue: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDeleteEntry: () => void;
}

// Modal unique pour ajouter la progression du jour et pour corriger une
// entrée passée depuis l'historique — voir app/goal/[id].tsx pour les deux
// déclencheurs (CTA "Ajouter" et ligne d'historique). État (modalMode/Date/
// Value/Error) et handlers restent dans l'écran : plusieurs déclencheurs
// différents doivent pouvoir ouvrir ce modal.
export default function ProgressEntryModal({
  mode,
  date,
  value,
  error,
  unit,
  todayEntry,
  onChangeValue,
  onClose,
  onSave,
  onDeleteEntry,
}: Props) {
  return (
    <Modal
      visible={mode !== null}
      transparent
      animationType="slide"
      // Cantonne le lecteur d'écran au contenu du modal tant qu'il est ouvert.
      accessibilityViewIsModal
    >
      {/* accessible={false} plutôt que accessibilityRole="button" : exposer
          toute la zone derrière le modal comme un "bouton" plein écran au
          lecteur d'écran serait plus perturbant qu'utile (cible géante,
          fait doublon avec "Annuler" dans la feuille — voir la doc RN sur
          ce pattern backdrop). Pas de importantForAccessibility
          "no-hide-descendants" ici : contrairement au cas générique où le
          backdrop n'a pas de descendant réel, la feuille modale (avec tout
          son contenu accessible) est nichée DANS ce Pressable pour que le
          tap dessus stoppe la propagation — la masquer masquerait le modal
          entier sur Android. accessible={false} n'affecte que ce
          Pressable lui-même, pas ses enfants. */}
      <Pressable style={styles.modalBackdrop} onPress={onClose} accessible={false}>
        {/* Empêche le tap sur la feuille elle-même de remonter au backdrop
            et de fermer le modal par erreur. */}
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{mode === 'add' ? "Aujourd'hui" : 'Modifier'}</Text>
            <Text style={styles.modalDate}>{date && longDateLabel(parseDate(date))}</Text>
          </View>
          {mode === 'add' && todayEntry && todayEntry.value > 0 && (
            <Text style={styles.modalAlready}>
              Déjà enregistré :{' '}
              <Text style={styles.modalAlreadyValue}>
                {fmt(todayEntry.value, unit)} {UNIT_LABELS[unit]}
              </Text>
            </Text>
          )}
          <View style={styles.modalInputRow}>
            <TextInput
              style={styles.modalInput}
              placeholder="0"
              placeholderTextColor={white(0.2)}
              keyboardType="numeric"
              autoFocus
              value={value}
              onChangeText={onChangeValue}
            />
            <View style={styles.modalUnitBox}>
              <Text style={styles.modalUnitText}>{UNIT_LABELS[unit]}</Text>
            </View>
          </View>
          {error && <Text style={styles.modalErrorText}>Entre une valeur supérieure à 0.</Text>}
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalButton,
                styles.modalConfirmButton,
                !(Number(value) > 0) && styles.modalConfirmButtonDisabled,
              ]}
              onPress={onSave}
              accessibilityRole="button"
            >
              <Text style={styles.modalConfirmText}>Enregistrer</Text>
            </Pressable>
          </View>
          {mode === 'edit' && (
            <Pressable style={styles.deleteLink} onPress={onDeleteEntry} accessibilityRole="button">
              <Text style={styles.deleteLinkText}>🗑 Supprimer cette entrée</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: white(0.08),
    padding: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: white(0.2),
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 22,
    textTransform: 'uppercase',
    color: colors.fg,
  },
  modalDate: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    textTransform: 'uppercase',
    color: colors.brand,
  },
  modalAlready: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: white(0.4),
    marginTop: 8,
  },
  modalAlreadyValue: {
    color: white(0.7),
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalInput: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: radius.button,
    paddingVertical: 16,
    textAlign: 'center',
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 28,
    color: colors.fg,
  },
  modalUnitBox: {
    width: 64,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: white(0.08),
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalUnitText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: white(0.5),
  },
  modalErrorText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.late,
    marginTop: 8,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: white(0.08),
  },
  modalCancelText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    textTransform: 'uppercase',
    color: white(0.6),
  },
  modalConfirmButton: {
    backgroundColor: colors.brand,
  },
  modalConfirmButtonDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 13,
    textTransform: 'uppercase',
    color: '#fff',
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteLinkText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: 'rgba(239,68,68,0.6)',
  },
});
