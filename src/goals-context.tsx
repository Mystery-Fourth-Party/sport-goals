// État partagé des objectifs + persistance, sorti de l'ancien App.tsx pour
// être accessible depuis tous les écrans (expo-router) plutôt que d'un seul
// composant racine avec tout en props.
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { loadGoals, saveGoals } from './storage';
import { todayStr } from './stats';
import { Goal } from './types';

interface GoalsContextValue {
  goals: Goal[];
  // Distingue "pas encore chargé" de "chargé mais vide", pour ne pas
  // écraser le storage avec un tableau vide au tout premier rendu.
  loaded: boolean;
  createGoal: (goal: Goal) => void;
  // Ajoute `amount` à l'entrée du jour (fusionnée si elle existe déjà, sinon
  // créée) plutôt que d'incrémenter un compteur séparé : `actual` est
  // toujours dérivé de la somme des entries par stats.ts, une seule source
  // de vérité. Pas de clamp ici : dépasser targetValue est possible,
  // ProgressBar se contente de clamper l'affichage.
  addProgress: (goalId: string, amount: number) => void;
  updateGoal: (goalId: string, updates: Partial<Goal>) => void;
  deleteGoal: (goalId: string) => void;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
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

  function createGoal(goal: Goal) {
    setGoals((prev) => [goal, ...prev]);
  }

  function addProgress(goalId: string, amount: number) {
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

  // Partial<Goal> : les écrans n'envoient que les champs édités (title,
  // targetValue, unit, deadline), entries et id restent inchangés.
  function updateGoal(goalId: string, updates: Partial<Goal>) {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, ...updates } : g)));
  }

  function deleteGoal(goalId: string) {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }

  return (
    <GoalsContext.Provider
      value={{ goals, loaded, createGoal, addProgress, updateGoal, deleteGoal }}
    >
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals(): GoalsContextValue {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals must be used within a GoalsProvider');
  return ctx;
}
