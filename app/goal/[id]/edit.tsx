import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GoalFields from '../../../src/components/GoalFields';
import { BackButton } from '../../../src/components/ui';
import { useGoals } from '../../../src/goals-context';
import { parseDurationDays } from '../../../src/goalValidation';
import { fmt, getGoalStats, todayStr } from '../../../src/stats';
import { colors, fontFamily, radius, spacing, statusColors, white } from '../../../src/theme';
import { Unit } from '../../../src/types';

export default function EditGoalScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, updateGoal } = useGoals();
  const goal = goals.find((g) => g.id === id);

  // Toujours appelés dans le même ordre, même si `goal` finit par être
  // undefined (voir garde ci-dessous) : les Hooks ne peuvent pas être
  // conditionnels. Les valeurs par défaut ne sont utilisées que le temps du
  // rendu qui précède le retour anticipé.
  const s = goal ? getGoalStats(goal, todayStr()) : null;
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(String(goal?.targetValue ?? ''));
  const [unit, setUnit] = useState<Unit>(goal?.unit ?? 'reps');
  const [days, setDays] = useState(String(Math.max(1, s?.remainingDays ?? 1)));
  const [saveAttempted, setSaveAttempted] = useState(false);
  // absent = true (voir types.ts) — reflété tel quel plutôt que normalisé,
  // pour ne pas introduire de valeur inventée pour un objectif qui n'avait
  // jamais explicitement ce champ.
  const [reminderEnabled, setReminderEnabled] = useState(goal?.reminderEnabled ?? true);
  const [reminderTime, setReminderTime] = useState<string | undefined>(goal?.reminderTime);

  if (!goal || !s) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.notFound}>{t('goalDetail.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const titleError = title.trim() === '' ? t('editGoal.titleRequired') : undefined;
  const targetNum = Number(target);
  const targetError =
    targetNum > 0
      ? targetNum < s.actual
        ? t('editGoal.targetTooLow', { value: fmt(s.actual, unit), unit: t(`unit.${unit}`) })
        : undefined
      : t('editGoal.targetPositive');
  // Même règle partagée qu'à la création (voir src/goalValidation.ts) :
  // refuse aussi les durées fractionnaires, qui donnaient une échéance le
  // jour même une fois tronquées par setDate.
  const daysValue = parseDurationDays(days);
  const daysNum = daysValue ?? 0;
  const daysError = daysValue === null ? t('editGoal.daysPositive') : undefined;
  const canSave = !titleError && !targetError && !daysError;

  // Recalcul en direct du nouveau rythme quotidien requis, comme le calcul
  // déjà fait dans GoalForm pour la création (voir EditGoalScreen dans le
  // prototype) — seulement affiché une fois le formulaire valide.
  const remaining = Math.max(0, targetNum - s.actual);
  const newDailyRequired = canSave && daysNum > 0 ? remaining / daysNum : 0;

  function handleSave() {
    if (!canSave) {
      setSaveAttempted(true);
      return;
    }
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + daysNum);
    updateGoal(goal!.id, {
      title: title.trim(),
      targetValue: targetNum,
      unit,
      deadline: deadline.toISOString(),
      // Toujours inclus (même quand undefined) : updateGoal merge par
      // spread, donc un champ absent de cet objet laisserait l'ancienne
      // valeur inchangée — ici on veut au contraire pouvoir repasser
      // reminderTime à undefined si l'utilisateur désactive l'horaire
      // personnalisé après l'avoir activé.
      reminderEnabled,
      reminderTime,
    });
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View>
          <Text style={styles.title}>{t('editGoal.title')}</Text>
          <Text style={styles.subtitle}>{t('editGoal.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>{t('editGoal.currentProgress')}</Text>
            <Text style={styles.summaryValue}>
              {fmt(s.actual, goal.unit)}
              <Text style={styles.summaryValueMuted}>
                {' '}
                / {goal.targetValue} {t(`unit.${goal.unit}`)}
              </Text>
            </Text>
          </View>
          <Text style={[styles.summaryPercent, { color: statusColors[s.status].text }]}>
            {(s.progress * 100).toFixed(0)}%
          </Text>
        </View>

        <GoalFields
          title={title}
          onTitleChange={setTitle}
          targetValue={target}
          onTargetValueChange={setTarget}
          unit={unit}
          onUnitChange={setUnit}
          durationLabel={t('editGoal.durationLabel')}
          duration={days}
          onDurationChange={setDays}
          titleError={saveAttempted ? titleError : undefined}
          targetValueError={saveAttempted ? targetError : undefined}
          durationError={saveAttempted ? daysError : undefined}
          reminderEnabled={reminderEnabled}
          onReminderEnabledChange={setReminderEnabled}
          reminderTime={reminderTime}
          onReminderTimeChange={setReminderTime}
        />

        {newDailyRequired > 0 && (
          <View style={styles.dailyAvgCard}>
            <Text style={styles.dailyAvgLabel}>{t('editGoal.newPace')}</Text>
            <Text style={styles.dailyAvgValue}>≈ {fmt(newDailyRequired, unit)}</Text>
            <Text style={styles.dailyAvgUnit}>
              {t('editGoal.remainingToComplete', {
                unit,
                value: fmt(remaining, unit),
                unitLabel: t(`unit.${unit}`),
              })}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.saveButton} onPress={handleSave} accessibilityRole="button">
          <Text style={styles.saveButtonText}>{t('editGoal.save')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 20,
  },
  title: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 22,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.fg,
  },
  subtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: white(0.35),
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 24,
    gap: spacing.gap,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: 14,
  },
  summaryLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: white(0.35),
  },
  summaryValue: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 20,
    color: colors.fg,
    marginTop: 2,
  },
  summaryValueMuted: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: white(0.35),
  },
  summaryPercent: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 28,
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
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: white(0.06),
  },
  saveButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: fontFamily.displayExtraBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notFound: {
    fontFamily: fontFamily.bodyRegular,
    color: white(0.4),
    textAlign: 'center',
    marginTop: 40,
  },
});
