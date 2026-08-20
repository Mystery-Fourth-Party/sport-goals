import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import GoalForm from './src/components/GoalForm';
import GoalItem from './src/components/GoalItem';
import { loadGoals, saveGoals } from './src/storage';
import { Goal } from './src/types';

export default function App() {
  const [goals, setGoals] = useState<Goal[]>([]);
  // Distingue "pas encore chargé" de "chargé mais vide", pour ne pas
  // écraser le storage avec un tableau vide au tout premier rendu.
  const [loaded, setLoaded] = useState(false);

  // Chargement initial depuis AsyncStorage (équivalent d'un fetch au mount).
  useEffect(() => {
    loadGoals().then((g) => {
      setGoals(g);
      setLoaded(true);
    });
  }, []);

  // Sauvegarde automatique à chaque changement de goals, une fois le
  // chargement initial terminé (sinon on écraserait avec [] avant loadGoals).
  useEffect(() => {
    if (loaded) saveGoals(goals);
  }, [goals, loaded]);

  function handleCreate(goal: Goal) {
    setGoals((prev) => [goal, ...prev]);
  }

  // Incrémente currentValue du goal ciblé. Pas de clamp ici : on autorise
  // à dépasser targetValue, c'est GoalItem qui clampe l'affichage de la barre.
  function handleAddProgress(goalId: string, amount: number) {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, currentValue: g.currentValue + amount } : g))
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* FlatList = équivalent RN d'une liste virtualisée (type react-window
          côté web) : ne monte que les items visibles à l'écran, plus
          performant qu'un .map() pour de longues listes. */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={goals}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GoalItem goal={item} onAddProgress={handleAddProgress} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          // Le formulaire est injecté en header de la liste (plutôt qu'au-dessus,
          // en dur) pour qu'il scrolle avec le contenu au lieu de rester figé.
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
