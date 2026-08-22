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
  // Remplace tout le tableau d'un coup (pas de fusion avec l'existant) —
  // utilisé par la restauration d'une sauvegarde (voir app/settings.tsx),
  // pas par une opération portant sur un objectif précis. Une restauration
  // n'est pas un événement de complétion : aucune notification n'est
  // déclenchée ici. Le rappel quotidien se reprogramme tout seul ensuite,
  // ReminderScheduler réagissant déjà à tout changement de référence de
  // `goals`.
  replaceAllGoals: (goals: Goal[]) => void;
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
  // Titre de l'objectif à notifier, posé depuis l'intérieur du updater de
  // setGoals dans addProgress (voir ce commentaire pour le pourquoi) et
  // consommé par l'effet juste en dessous.
  const pendingGoalReachedTitle = useRef<string | null>(null);

  // Envoie la notification "objectif atteint" décidée par le plus récent
  // addProgress, une fois l'état effectivement commité — jamais lue depuis
  // l'intérieur du updater lui-même (voir addProgress) ni juste après
  // l'appel à setGoals (l'updater n'est pas garanti de s'être exécuté à ce
  // moment-là). Sans dépendances : tourne après chaque rendu, mais ne fait
  // quelque chose que si le ref a été armé, qu'il vide aussitôt.
  useEffect(() => {
    if (pendingGoalReachedTitle.current) {
      const title = pendingGoalReachedTitle.current;
      pendingGoalReachedTitle.current = null;
      sendGoalReachedNotification(title);
    }
  });

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
    // Capturé une seule fois ici plutôt qu'appelé à l'intérieur de
    // l'updater ci-dessous : cet updater peut être réinvoqué avec le même
    // `prev` par StrictMode et doit rester déterministe pour ce `prev` —
    // même raison que `today`, qui suit déjà ce principe.
    const now = new Date().toISOString();

    // Tout calculé à partir de `prev` (l'état passé au updater), jamais de
    // `goals` lu depuis la fermeture du composant : si addProgress est
    // appelé deux fois avant qu'un rendu ne s'intercale (double-tap sans
    // garde anti-rebond), React applique les deux updaters l'un après
    // l'autre, chacun recevant le résultat du précédent comme `prev` — donc
    // rien n'est perdu et "était-ce déjà complété avant ce call précis" se
    // décide sur le bon état. Même principe que updateEntry/deleteEntry.
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;

        const idx = g.entries.findIndex((e) => e.date === today);
        // recordedAt représente le dernier enregistrement sur cette entrée
        // (pas sa création) : posé aussi bien sur une nouvelle entrée que
        // sur une fusion.
        const entries =
          idx >= 0
            ? g.entries.map((e, i) =>
                i === idx ? { date: today, value: e.value + amount, recordedAt: now } : e,
              )
            : [...g.entries, { date: today, value: amount, recordedAt: now }];
        const updated: Goal = { ...g, entries };

        // Ne notifie qu'au moment précis où le statut *passe* à "completed",
        // pas à chaque ajout une fois déjà atteint (sinon spam à chaque
        // progression ajoutée après coup). Le titre est posé dans un ref
        // plutôt qu'envoyé ici directement : cet updater doit rester pur
        // (StrictMode peut le réinvoquer avec le même `prev`, auquel cas il
        // réécrit juste la même valeur — sans risque), l'envoi réel de la
        // notification est un effet de bord réservé à l'effect au-dessus,
        // qui tourne une fois l'état effectivement commité.
        if (settings.goalReachedNotifs) {
          const wasCompleted = getGoalStats(g, today).status === 'completed';
          const isCompleted = getGoalStats(updated, today).status === 'completed';
          if (!wasCompleted && isCompleted) {
            pendingGoalReachedTitle.current = g.title;
          }
        }

        return updated;
      }),
    );
  }

  function updateEntry(goalId: string, date: string, newValue: number) {
    if (newValue <= 0) return;
    // Même raison que dans addProgress : capturé une seule fois ici, pas
    // appelé à l'intérieur de l'updater.
    const now = new Date().toISOString();
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const idx = g.entries.findIndex((e) => e.date === date);
        if (idx < 0) return g;
        const entries = [...g.entries];
        // Une correction est aussi un enregistrement.
        entries[idx] = { date, value: newValue, recordedAt: now };
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

  function replaceAllGoals(newGoals: Goal[]) {
    setGoals(newGoals);
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
        replaceAllGoals,
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
