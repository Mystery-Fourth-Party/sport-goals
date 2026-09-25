import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../src/components/ui';
import GoalCard from '../src/components/GoalCard';
import { useGoals } from '../src/goals-context';
import { splitGoalsByClosure } from '../src/stats';
import { useToday } from '../src/useToday';
import { colors, fontFamily, spacing, white } from '../src/theme';

export default function ArchiveScreen() {
  const { t } = useTranslation();
  const { goals } = useGoals();
  const today = useToday();
  const { closed } = splitGoalsByClosure(goals, today);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>{t('archive.title')}</Text>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={closed}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          // Même onPress que la liste principale : l'écran de détail se
          // met lui-même en lecture seule sur un objectif clos (voir
          // isGoalClosed dans stats.ts). La carte porte le badge du statut
          // final (reached / exceeded / failed).
          <GoalCard goal={item} onPress={() => router.push(`/goal/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>{t('archive.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('archive.emptyText')}</Text>
          </View>
        }
      />
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingTop: 0,
    paddingBottom: 40,
    gap: spacing.gap,
  },
  separator: {
    height: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 26,
    textTransform: 'uppercase',
    color: colors.fg,
  },
  emptyText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: white(0.4),
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
    lineHeight: 20,
  },
});
