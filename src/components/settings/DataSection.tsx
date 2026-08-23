import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildBackupPayload, parseBackupPayload } from '../../backup';
import { useGoals } from '../../goals-context';
import { useSettings } from '../../settings-context';
import { todayStr } from '../../stats';
import { settingsStyles as s } from './styles';

// "objectif-sport-2026-08-22.json" — un fichier par jour d'export, écrasé si
// on exporte plusieurs fois le même jour plutôt que d'empiler des fichiers
// identiques en fond (hors web, voir handleExport).
function backupFilename(): string {
  return `objectif-sport-${todayStr()}.json`;
}

// Export/import JSON (voir src/backup.ts) + le statut d'erreur qui leur est
// propre. Découpé hors de app/settings.tsx sans changement de comportement
// — voir aussi NotificationsSection pour la carte "Notifications".
export default function DataSection() {
  const { settings, updateSettings } = useSettings();
  const { goals, replaceAllGoals } = useGoals();
  // Même pattern que notifError (NotificationsSection).
  const [dataError, setDataError] = useState<string | undefined>();

  async function handleExport() {
    setDataError(undefined);
    const json = JSON.stringify(buildBackupPayload(goals, settings, todayStr()), null, 2);
    const filename = backupFilename();

    try {
      if (Platform.OS === 'web') {
        // expo-sharing n'a pas d'équivalent web (comme expo-notifications) :
        // déclenche un téléchargement via un <a download> créé et cliqué par
        // script, jamais monté dans le JSX.
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      file.write(json);

      if (!(await Sharing.isAvailableAsync())) {
        setDataError("Le partage de fichiers n'est pas disponible sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch (error) {
      console.error('handleExport: échec.', error);
      setDataError("Échec de l'export — réessaie.");
    }
  }

  // Commun aux deux plateformes une fois le contenu du fichier lu (voir
  // handleImport ci-dessous) : parse, valide, et ne remplace qu'après
  // confirmation explicite — même pattern Alert.alert / window.confirm que
  // handleDelete des écrans objectif (voir app/goal/[id].tsx).
  function confirmAndImport(text: string) {
    const result = parseBackupPayload(text);
    if (!result.ok) {
      setDataError(result.error);
      return;
    }
    setDataError(undefined);

    const importedCount = result.goals.length;
    const currentCount = goals.length;
    const message = `Ça va REMPLACER tes ${currentCount} objectif(s) actuel(s) par les ${importedCount} objectif(s) de ce fichier.`;
    const confirmed = () => {
      replaceAllGoals(result.goals);
      if (result.settings) updateSettings(result.settings);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Importer ces données ?\n\n${message}`)) confirmed();
      return;
    }
    Alert.alert('Importer ces données ?', message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Importer', style: 'destructive', onPress: confirmed },
    ]);
  }

  async function handleImport() {
    setDataError(undefined);
    try {
      if (Platform.OS === 'web') {
        // Input caché, créé et déclenché par script — jamais monté dans le
        // JSX, même esprit que le <a download> de handleExport.
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = () => {
          const picked = input.files?.[0];
          if (!picked) return; // annulation : rien ne se passe.
          const reader = new FileReader();
          reader.onload = () => confirmAndImport(String(reader.result ?? ''));
          reader.onerror = () => setDataError('Échec de la lecture du fichier.');
          reader.readAsText(picked);
        };
        input.click();
        return;
      }

      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (picked.canceled) return; // rien ne se passe.
      const text = await new File(picked.assets[0].uri).text();
      confirmAndImport(text);
    } catch (error) {
      console.error('handleImport: échec.', error);
      setDataError("Échec de l'import — réessaie.");
    }
  }

  return (
    <>
      <Text style={[s.sectionLabel, s.sectionLabelSpaced]}>Données</Text>
      {dataError && <Text style={s.errorText}>{dataError}</Text>}
      <View style={s.card}>
        <Pressable style={[s.row, s.rowBorder]} onPress={handleExport}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>Exporter mes données</Text>
            <Text style={s.rowSubtitle}>
              Sauvegarde tes objectifs et réglages dans un fichier JSON
            </Text>
          </View>
          <Text style={s.rowChevron}>›</Text>
        </Pressable>
        <Pressable style={s.row} onPress={handleImport}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>Importer des données</Text>
            <Text style={s.rowSubtitle}>Remplace tes objectifs actuels par un fichier exporté</Text>
          </View>
          <Text style={s.rowChevron}>›</Text>
        </Pressable>
      </View>
    </>
  );
}
