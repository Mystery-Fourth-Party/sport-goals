import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildBackupPayload, parseBackupPayload } from '../../backup';
import { confirmDestructive } from '../../confirm';
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
  const { t } = useTranslation();
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
        setDataError(t('data.sharingUnavailable'));
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch (error) {
      console.error('handleExport: échec.', error);
      setDataError(t('data.exportFailed'));
    }
  }

  // Commun aux deux plateformes une fois le contenu du fichier lu (voir
  // handleImport ci-dessous) : parse, valide, et ne remplace qu'après
  // confirmation explicite — voir confirmDestructive (src/confirm.ts),
  // partagé avec handleDelete/handleDeleteEntry (app/goal/[id].tsx).
  function confirmAndImport(text: string) {
    const result = parseBackupPayload(text);
    if (!result.ok) {
      setDataError(result.error);
      return;
    }
    setDataError(undefined);

    const importedCount = result.goals.length;
    const currentCount = goals.length;
    confirmDestructive({
      title: t('data.importConfirmTitle'),
      message: t('data.importConfirmMessage', {
        currentPart: t('data.importCurrentCount', { count: currentCount }),
        importedPart: t('data.importedGoalCount', { count: importedCount }),
      }),
      confirmLabel: t('common.import'),
      onConfirm: () => {
        replaceAllGoals(result.goals);
        if (result.settings) updateSettings(result.settings);
      },
    });
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
          reader.onerror = () => setDataError(t('data.readFailed'));
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
      setDataError(t('data.importFailed'));
    }
  }

  return (
    <>
      <Text style={[s.sectionLabel, s.sectionLabelSpaced]}>{t('data.sectionTitle')}</Text>
      {dataError && <Text style={s.errorText}>{dataError}</Text>}
      <View style={s.card}>
        <Pressable style={[s.row, s.rowBorder]} onPress={handleExport} accessibilityRole="button">
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>{t('data.exportTitle')}</Text>
            <Text style={s.rowSubtitle}>{t('data.exportSubtitle')}</Text>
          </View>
          <Text style={s.rowChevron}>›</Text>
        </Pressable>
        <Pressable style={s.row} onPress={handleImport} accessibilityRole="button">
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>{t('data.importTitle')}</Text>
            <Text style={s.rowSubtitle}>{t('data.importSubtitle')}</Text>
          </View>
          <Text style={s.rowChevron}>›</Text>
        </Pressable>
      </View>
    </>
  );
}
