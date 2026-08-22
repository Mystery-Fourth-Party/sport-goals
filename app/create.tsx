import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GoalForm from '../src/components/GoalForm';
import { BackButton } from '../src/components/ui';
import { useGoals } from '../src/goals-context';
import { colors, fontFamily, spacing } from '../src/theme';
import { Goal } from '../src/types';

export default function CreateGoalScreen() {
  const { createGoal } = useGoals();

  function handleCreate(goal: Goal) {
    createGoal(goal);
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Nouvel Objectif</Text>
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <GoalForm onCreate={handleCreate} />
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
  keyboardAvoider: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
  },
});
