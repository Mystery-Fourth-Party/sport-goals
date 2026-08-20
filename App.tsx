import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import GoalForm from './src/components/GoalForm';
import GoalItem from './src/components/GoalItem';
import { loadGoals, saveGoals } from './src/storage';
import { Goal } from './src/types';

export default function App() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadGoals().then((g) => {
      setGoals(g);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveGoals(goals);
  }, [goals, loaded]);

  function handleCreate(goal: Goal) {
    setGoals((prev) => [goal, ...prev]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={goals}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GoalItem goal={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>Mes objectifs sportifs</Text>
            <GoalForm onCreate={handleCreate} />
            {goals.length > 0 && <Text style={styles.subheading}>En cours</Text>}
          </>
        }
        ListEmptyComponent={
          loaded ? <Text style={styles.empty}>Aucun objectif pour l'instant.</Text> : null
        }
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  subheading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginTop: 20,
    marginBottom: 4,
  },
  separator: {
    height: 10,
  },
  empty: {
    marginTop: 12,
    color: '#888',
    textAlign: 'center',
  },
});
