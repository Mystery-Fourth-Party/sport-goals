import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GoalForm from '../src/components/GoalForm';
import { BackButton } from '../src/components/ui';
import { goalToFormValues } from '../src/goalFormValues';
import { useGoals } from '../src/goals-context';
import { hasSuccessor } from '../src/series';
import { isGoalClosed } from '../src/stats';
import { colors, fontFamily, spacing, white } from '../src/theme';
import { Goal } from '../src/types';
import { useToday } from '../src/useToday';

export default function CreateGoalScreen() {
  const { t } = useTranslation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { goals, loaded, createGoal } = useGoals();
  const today = useToday();

  // Relance : /create?from=<id> ne porte que l'identifiant, jamais les
  // valeurs, pour que l'objectif source reste la seule vérité. Une source
  // absente ou non close (lien profond, état obsolète) donne un formulaire
  // vide ordinaire, sans erreur : relancer un objectif en cours en ferait un
  // doublon, pas une relance.
  const source = goals.find((g) => g.id === from);
  const restartFrom = source !== undefined && isGoalClosed(source, today) ? source : undefined;
  // Sans loaded, `goals` vaut encore [] et la source n'est pas trouvable.
  // GoalForm ne lit initialValues qu'au montage : le monter avant la fin du
  // chargement le figerait vide pour toute la vie de l'écran (lien profond à
  // froid). Même garde que EditGoalScreen. Sans `from`, rien à attendre.
  const waitingForSource = from !== undefined && !loaded;
  // Le bouton « Relancer » est masqué sur une occurrence qui a une suite (voir
  // GoalDetailScreen) : un lien direct ne doit pas le contourner. Même refus que
  // l'écran de modification pour un objectif clos, plutôt qu'un formulaire qui
  // créerait un doublon de la série. Lu seulement une fois les objectifs
  // chargés : avant, la source n'est pas trouvable (voir waitingForSource).
  const refused = restartFrom !== undefined && hasSuccessor(goals, restartFrom);

  function handleCreate(goal: Goal) {
    createGoal(goal);
    // dismissTo plutôt que back() : la pile est [accueil, (archive,) détail,
    // création], et back() ramènerait sur l'objectif archivé. dismissTo('/')
    // remonte jusqu'à l'accueil déjà présent sans en empiler un second.
    if (restartFrom) router.dismissTo('/');
    else router.back();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        {!waitingForSource && !refused && (
          <Text style={styles.title}>
            {restartFrom ? t('create.restartTitle') : t('create.title')}
          </Text>
        )}
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* key : deux sources différentes ne partagent pas un état de saisie. */}
          {refused && <Text style={styles.refused}>{t('create.alreadyRepeated')}</Text>}
          {!waitingForSource && !refused && (
            <GoalForm
              key={restartFrom?.id ?? 'blank'}
              onCreate={handleCreate}
              initialValues={restartFrom && goalToFormValues(restartFrom, today)}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  refused: {
    fontFamily: fontFamily.bodyRegular,
    color: white(0.4),
    textAlign: 'center',
    marginTop: 40,
  },
  keyboardAvoider: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
  },
});
