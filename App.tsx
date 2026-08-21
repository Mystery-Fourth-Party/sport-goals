import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import GoalForm from './src/components/GoalForm';
import GoalItem from './src/components/GoalItem';
import { loadGoals, saveGoals } from './src/storage';
import { getGoalStats, todayStr } from './src/stats';
import { colors, fontFamily, spacing, useAppFonts } from './src/theme';
import { Goal } from './src/types';

export default function App() {
  const [fontsLoaded, fontError] = useAppFonts();

  const [goals, setGoals] = useState<Goal[]>([]);
  // Distingue "pas encore chargé" de "chargé mais vide", pour ne pas
  // écraser le storage avec un tableau vide au tout premier rendu.
  const [loaded, setLoaded] = useState(false);
  // true tant qu'on n'a pas encore ignoré le premier passage de l'effet de
  // sauvegarde suivant le chargement (ce passage sauvegarderait des données
  // identiques à ce qui vient d'être lu, donc redondant).
  const skipNextSave = useRef(true);

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
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveGoals(goals);
  }, [goals, loaded]);

  function handleCreate(goal: Goal) {
    setGoals((prev) => [goal, ...prev]);
  }

  // Ajoute `amount` à l'entrée du jour (fusionnée si elle existe déjà, sinon
  // créée) plutôt que d'incrémenter un compteur séparé : `actual` est
  // toujours dérivé de la somme des entries par stats.ts, une seule source
  // de vérité. Pas de clamp ici : dépasser targetValue est possible,
  // ProgressBar se contente de clamper l'affichage.
  function handleAddProgress(goalId: string, amount: number) {
    const today = todayStr();
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const idx = g.entries.findIndex((e) => e.date === today);
        if (idx >= 0) {
          const entries = [...g.entries];
          entries[idx] = { date: today, value: entries[idx].value + amount };
          return { ...g, entries };
        }
        return { ...g, entries: [...g.entries, { date: today, value: amount }] };
      }),
    );
  }

  // Partial<Goal> : GoalItem ne renvoie que les champs édités (title,
  // targetValue, unit, deadline), entries et id restent inchangés.
  function handleUpdate(goalId: string, updates: Partial<Goal>) {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, ...updates } : g)));
  }

  function handleDelete(goalId: string) {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }

  // Rien à afficher tant que les polices ne sont pas prêtes (ou en échec) :
  // évite un flash avec les polices système avant que Barlow Condensed/
  // Outfit ne soient disponibles.
  if (!fontsLoaded && !fontError) return null;

  const today = todayStr();
  const active = goals.filter((g) => getGoalStats(g, today).status !== 'completed').length;
  const done = goals.length - active;

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
        renderItem={({ item }) => (
          <GoalItem
            goal={item}
            onAddProgress={handleAddProgress}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          // Le formulaire est injecté en header de la liste (plutôt qu'au-dessus,
          // en dur) pour qu'il scrolle avec le contenu au lieu de rester figé.
          <>
            <Text style={styles.heading}>Mes{'\n'}Objectifs</Text>

            {goals.length > 0 && (
              <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.statCardActive]}>
                  <Text style={[styles.statLabel, { color: colors.brand }]}>En cours</Text>
                  <Text style={styles.statValue}>{active}</Text>
                </View>
                <View style={[styles.statCard, styles.statCardDone]}>
                  <Text style={[styles.statLabel, { color: colors.ahead }]}>Terminés</Text>
                  <Text style={styles.statValue}>{done}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabelMuted}>Total</Text>
                  <Text style={styles.statValue}>{goals.length}</Text>
                </View>
              </View>
            )}

            <View style={styles.formCard}>
              <GoalForm onCreate={handleCreate} />
            </View>
          </>
        }
        ListEmptyComponent={
          loaded ? <Text style={styles.empty}>Aucun objectif pour l&apos;instant.</Text> : null
        }
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.screenPadding,
    gap: spacing.gap,
  },
  heading: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 34,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 36,
    color: colors.fg,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statCardActive: {
    backgroundColor: 'rgba(255,107,0,0.1)',
    borderColor: 'rgba(255,107,0,0.15)',
  },
  statCardDone: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.15)',
  },
  statLabel: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statLabelMuted: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.35)',
  },
  statValue: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 22,
    color: colors.fg,
    marginTop: 2,
  },
  formCard: {
    marginBottom: 4,
  },
  separator: {
    height: 12,
  },
  empty: {
    marginTop: 12,
    fontFamily: fontFamily.bodyRegular,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
});
