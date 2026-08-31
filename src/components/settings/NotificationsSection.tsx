import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  ensureNotificationPermission,
  notificationsSupported,
  parseReminderTime,
} from '../../notifications';
import { useReminderStatus } from '../../reminder-status';
import { useSettings } from '../../settings-context';
import { TimeField, Toggle } from '../ui';
import { settingsStyles as s } from './styles';

// 4 toggles + le time picker multi-plateforme (voir src/components/ui/
// TimeField) + les statuts d'erreur qui leur sont propres (notifError/
// reminderTimeError/le statut de reprogrammation posé par
// ReminderScheduler). Découpé hors de app/settings.tsx (474 lignes,
// UI+logique+styles mélangés) sans changement de comportement — voir aussi
// DataSection pour la carte "Données".
export default function NotificationsSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { error: reminderStatusError } = useReminderStatus();
  // Message affiché si la demande de permission échoue (plateforme non
  // supportée ou refus de l'utilisateur) — voir requestPermissionOrExplain.
  const [notifError, setNotifError] = useState<string | undefined>();

  // Le picker natif (iOS/Android) ne peut pas produire de valeur invalide ;
  // seul le repli texte libre du web (voir TimeField) en a besoin.
  const reminderTimeError =
    Platform.OS === 'web' && settings.dailyReminder && !parseReminderTime(settings.reminderTime)
      ? t('notifications.invalidTimeFormat')
      : undefined;

  // La permission est demandée ici, au moment où l'utilisateur active un
  // toggle qui en a besoin — pas au lancement de l'app, ni pour les toggles
  // qui ne déclenchent rien de réel (almostThereNotifs ne pilote qu'une
  // bannière in-app, voir app/goal/[id].tsx). Ce mécanisme couvre le refus
  // AVANT que le toggle ne passe à "on" ; reminderStatusError (ci-dessus)
  // couvre ce qui se dérègle APRÈS coup lors des reprogrammations
  // automatiques (voir ReminderScheduler) — les deux coexistent.
  async function requestPermissionOrExplain(): Promise<boolean> {
    if (!notificationsSupported()) {
      setNotifError(t('notifications.unavailableWeb'));
      return false;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      setNotifError(t('notifications.denied'));
      return false;
    }
    setNotifError(undefined);
    return true;
  }

  async function handleDailyReminderToggle(v: boolean) {
    if (v && !(await requestPermissionOrExplain())) return;
    updateSettings({ dailyReminder: v });
  }

  async function handleGoalReachedToggle(v: boolean) {
    if (v && !(await requestPermissionOrExplain())) return;
    updateSettings({ goalReachedNotifs: v });
  }

  // Un seul élément accessible par ligne de toggle (même principe que
  // GoalCard) : TalkBack annonçait sinon le titre, le sous-titre et le
  // Toggle comme 3 éléments séparés. Le libellé composite va sur le Toggle,
  // seul élément actionnable de la ligne, et les Text de la ligne sont
  // masqués au lecteur d'écran. L'état activé/désactivé n'est pas concaténé
  // ici : il vient déjà de accessibilityState.checked posé par Toggle.
  const rowA11yLabel = (key: string) =>
    `${t(`notifications.${key}`)}, ${t(`notifications.${key}Subtitle`)}`;

  return (
    <>
      <Text style={s.sectionLabel}>{t('notifications.sectionTitle')}</Text>
      {notifError && <Text style={s.errorText}>{notifError}</Text>}
      <View style={s.card}>
        <View style={[s.row, s.rowBorder]}>
          <View
            style={s.rowTexts}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={s.rowTitle}>{t('notifications.dailyReminder')}</Text>
            <Text style={s.rowSubtitle}>{t('notifications.dailyReminderSubtitle')}</Text>
          </View>
          <Toggle
            value={settings.dailyReminder}
            onChange={handleDailyReminderToggle}
            accessibilityLabel={rowA11yLabel('dailyReminder')}
          />
        </View>

        {settings.dailyReminder && (
          <View style={[s.row, s.rowBorder, styles.rowWrap]}>
            <View style={styles.timeRow}>
              <Text style={s.rowTitle}>{t('notifications.reminderTime')}</Text>
              <TimeField
                value={settings.reminderTime}
                onChange={(v) => updateSettings({ reminderTime: v })}
              />
            </View>
            {reminderTimeError && <Text style={s.errorText}>{reminderTimeError}</Text>}
            {/* Distinct de reminderTimeError : couvre l'échec d'une
                reprogrammation automatique après coup (permission révoquée
                entre-temps...), posé par ReminderScheduler via
                useReminderStatus — pas une validation de saisie. */}
            {reminderStatusError && <Text style={s.errorText}>{reminderStatusError}</Text>}
          </View>
        )}

        <View style={[s.row, s.rowBorder]}>
          <View
            style={s.rowTexts}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={s.rowTitle}>{t('notifications.goalReached')}</Text>
            <Text style={s.rowSubtitle}>{t('notifications.goalReachedSubtitle')}</Text>
          </View>
          <Toggle
            value={settings.goalReachedNotifs}
            onChange={handleGoalReachedToggle}
            accessibilityLabel={rowA11yLabel('goalReached')}
          />
        </View>

        <View style={[s.row, s.rowBorder]}>
          <View
            style={s.rowTexts}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={s.rowTitle}>{t('notifications.almostThere')}</Text>
            <Text style={s.rowSubtitle}>{t('notifications.almostThereSubtitle')}</Text>
          </View>
          <Toggle
            value={settings.almostThereNotifs}
            onChange={(v) => updateSettings({ almostThereNotifs: v })}
            accessibilityLabel={rowA11yLabel('almostThere')}
          />
        </View>

        <View style={s.row}>
          <View
            style={s.rowTexts}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={s.rowTitle}>{t('notifications.streakAlert')}</Text>
            <Text style={s.rowSubtitle}>{t('notifications.streakAlertSubtitle')}</Text>
          </View>
          <Toggle
            value={settings.streakAlert}
            onChange={(v) => updateSettings({ streakAlert: v })}
            accessibilityLabel={rowA11yLabel('streakAlert')}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
