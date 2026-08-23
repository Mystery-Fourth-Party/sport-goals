// Statut de la dernière (re)programmation du rappel quotidien — jamais
// persisté, contrairement à Settings (voir AGENTS.md : état dérivé, jamais
// dupliqué). Contexte séparé de settings-context.tsx exprès : `settings` y
// est auto-sauvegardé sur AsyncStorage à chaque changement (voir son effet
// de sauvegarde dans settings-context.tsx), un état d'erreur transitoire
// n'a rien à y faire. Écrit par ReminderScheduler, lu par SettingsScreen.
import { createContext, ReactNode, useContext, useState } from 'react';

interface ReminderStatusContextValue {
  error: string | undefined;
  setError: (error: string | undefined) => void;
}

const ReminderStatusContext = createContext<ReminderStatusContextValue | null>(null);

export function ReminderStatusProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | undefined>();

  return (
    <ReminderStatusContext.Provider value={{ error, setError }}>
      {children}
    </ReminderStatusContext.Provider>
  );
}

export function useReminderStatus(): ReminderStatusContextValue {
  const ctx = useContext(ReminderStatusContext);
  if (!ctx) throw new Error('useReminderStatus must be used within a ReminderStatusProvider');
  return ctx;
}
