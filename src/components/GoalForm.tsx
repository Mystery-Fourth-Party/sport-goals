import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Goal, Unit } from '../types';
import { parseDurationDays } from '../goalValidation';
import { fmt } from '../stats';
import { colors, fontFamily, radius, spacing } from '../theme';
import GoalFields from './GoalFields';

interface Props {
  onCreate: (goal: Goal) => void;
}

export default function GoalForm({ onCreate }: Props) {
  const { t } = useTranslation();
  // Formulaire contrôlé classique (comme en React web) : un useState par champ.
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState<Unit>('reps');
  const [durationDays, setDurationDays] = useState('');
  // Actif par défaut (voir types.ts) ; reminderTime absent = hérite de
  // l'horaire global tant que l'utilisateur n'active pas "Horaire
  // personnalisé".
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState<string | undefined>(undefined);
  // Les erreurs ne s'affichent qu'après une première tentative de soumission
  // invalide, pour ne pas asperger l'utilisateur de messages rouges dès
  // qu'il commence à remplir le formulaire.
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const titleError = title.trim() === '' ? t('goalForm.titleRequired') : undefined;
  const targetValueError = Number(targetValue) > 0 ? undefined : t('goalForm.targetPositive');
  // parseDurationDays plutôt qu'un `> 0` inline : la règle est partagée avec
  // l'écran Édition et refuse aussi les durées fractionnaires, qui
  // produisaient une échéance le jour même (voir src/goalValidation.ts).
  const durationDaysValue = parseDurationDays(durationDays);
  const durationError = durationDaysValue === null ? t('goalForm.durationPositive') : undefined;
  const canSubmit = !titleError && !targetValueError && !durationError;

  // Rythme quotidien requis affiché en direct dès que les 3 champs sont
  // valides (voir design-tokens.md § Création : "calcule les dates").
  const targetNum = Number(targetValue) || 0;
  const daysNum = durationDaysValue ?? 0;
  const dailyAvg = canSubmit ? targetNum / daysNum : 0;

  function handleSubmit() {
    if (!canSubmit) {
      setSubmitAttempted(true);
      return;
    }

    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + daysNum);

    onCreate({
      // Le global crypto.randomUUID() n'est pas garanti sur Hermes (natif) ;
      // expo-crypto fournit une implémentation fiable sur toutes les plateformes.
      id: Crypto.randomUUID(),
      title: title.trim(),
      targetValue: targetNum,
      unit,
      createdAt: now.toISOString(),
      deadline: deadline.toISOString(),
      entries: [],
      reminderEnabled,
      reminderTime,
    });

    setTitle('');
    setTargetValue('');
    setDurationDays('');
    setUnit('reps');
    setReminderEnabled(true);
    setReminderTime(undefined);
    setSubmitAttempted(false);
  }

  return (
    <View style={styles.container}>
      <GoalFields
        title={title}
        onTitleChange={setTitle}
        targetValue={targetValue}
        onTargetValueChange={setTargetValue}
        unit={unit}
        onUnitChange={setUnit}
        durationLabel={t('goalForm.durationLabel')}
        duration={durationDays}
        onDurationChange={setDurationDays}
        titleError={submitAttempted ? titleError : undefined}
        targetValueError={submitAttempted ? targetValueError : undefined}
        durationError={submitAttempted ? durationError : undefined}
        reminderEnabled={reminderEnabled}
        onReminderEnabledChange={setReminderEnabled}
        reminderTime={reminderTime}
        onReminderTimeChange={setReminderTime}
      />

      {dailyAvg > 0 && (
        <View style={styles.dailyAvgCard}>
          <Text style={styles.dailyAvgLabel}>{t('goalForm.dailyAvgRequired')}</Text>
          <Text style={styles.dailyAvgValue}>≈ {fmt(dailyAvg, unit)}</Text>
          <Text style={styles.dailyAvgUnit}>{t('goalForm.perDay', { unit })}</Text>
        </View>
      )}

      {/* Pressable = équivalent RN de <button onClick>. Reste toujours
          actif : une tentative de soumission invalide affiche les erreurs
          inline plutôt que de simplement ignorer le press. */}
      <Pressable style={styles.button} onPress={handleSubmit} accessibilityRole="button">
        <Text style={styles.buttonText}>{t('goalForm.submit')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.gap,
  },
  dailyAvgCard: {
    backgroundColor: colors.brandGlow,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.2)',
    borderRadius: radius.card,
    padding: spacing.cardPadding,
  },
  dailyAvgLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.brand,
    marginBottom: 4,
  },
  dailyAvgValue: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 40,
    color: colors.fg,
    lineHeight: 44,
  },
  dailyAvgUnit: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: 'rgba(255,183,140,0.7)',
    marginTop: 2,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
