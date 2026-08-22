// État partagé des objectifs + persistance, sorti de l'ancien App.tsx pour
// être accessible depuis tous les écrans (expo-router) plutôt que d'un seul
// composant racine avec tout en props.
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { sendGoalReachedNotification } from './notifications';
import { useSettings } from './settings-context';
import { loadGoals, saveGoals } from './storage';
import { getGoalStats, todayStr } from './stats';
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
  // Remplace la valeur de l'entrée existante à `date` (ne s'additionne pas,
  // contrairement à addProgress) — corrige une saisie, ne "progresse" pas.
  // newValue <= 0 est ignoré ici (pas seulement côté UI) : mettre une entrée
  // à 0 par cette voie serait équivoque avec deleteEntry, voir son commentaire.
  updateEntry: (goalId: string, date: string, newValue: number) => void;
  // Retire l'entrée du jour du tableau plutôt que de la mettre à 0 :
  // `value: 0` reste une valeur valide et signifiante ailleurs (voir
  // ongoingGoalsWithoutTodayEntry dans notifications.ts), donc "il n'y a
  // pas d'entrée ce jour-là" doit rester distinct de "il y a une entrée à
  // 0 ce jour-là".
  deleteEntry: (goalId: string, date: string) => void;
  updateGoal: (goalId: string, updates: Partial<Goal>) => void;
  deleteGoal: (goalId: string) => void;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  // Rendu à l'intérieur de SettingsProvider (voir app/_layout.tsx) : lit le
  // toggle "objectif atteint" pour savoir si addProgress doit notifier.
  const { settings } = useSettings();
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
    // Capturée en dehors du updater de setGoals plutôt qu'en y appelant
    // directement sendGoalReachedNotification : un updater peut être
    // ré-invoqué (StrictMode) et doit rester pur, alors que l'envoi de la
    // notification est un effet de bord qui ne doit se produire qu'une fois.
    let justCompletedTitle: string | null = null;

    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;

        let updated: Goal;
        const idx = g.entries.findIndex((e) => e.date === today);
        if (idx >= 0) {
          const entries = [...g.entries];
          entries[idx] = { date: today, value: entries[idx].value + amount };
          updated = { ...g, entries };
        } else {
          updated = { ...g, entries: [...g.entries, { date: today, value: amount }] };
        }

        // Ne notifie qu'au moment précis où le statut *passe* à "completed",
        // pas à chaque ajout une fois déjà atteint (sinon spam à chaque
        // progression ajoutée après coup).
        if (settings.goalReachedNotifs) {
          const wasCompleted = getGoalStats(g, today).status === 'completed';
          const isCompleted = getGoalStats(updated, today).status === 'completed';
          if (!wasCompleted && isCompleted) {
            justCompletedTitle = g.title;
          }
        }

        return updated;
      }),
    );

    if (justCompletedTitle) {
      sendGoalReachedNotification(justCompletedTitle);
    }
  }

  function updateEntry(goalId: string, date: string, newValue: number) {
    if (newValue <= 0) return;
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const idx = g.entries.findIndex((e) => e.date === date);
        if (idx < 0) return g;
        const entries = [...g.entries];
        entries[idx] = { date, value: newValue };
        return { ...g, entries };
      }),
    );
  }

  function deleteEntry(goalId: string, date: string) {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, entries: g.entries.filter((e) => e.date !== date) } : g,
      ),
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
      value={{
        goals,
        loaded,
        createGoal,
        addProgress,
        updateEntry,
        deleteEntry,
        updateGoal,
        deleteGoal,
      }}
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
