// État partagé des réglages + persistance, même pattern que goals-context.tsx.
// Un contexte séparé plutôt qu'un seul "app state" fourre-tout : Settings et
// Goal n'ont rien en commun et évoluent indépendamment, mais tous deux
// doivent être lisibles depuis plusieurs écrans (ex: le toggle "objectif
// bientôt atteint" de /settings pilote la bannière de /goal/[id]).
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './settingsStorage';

interface SettingsContextValue {
  settings: Settings;
  loaded: boolean;
  updateSettings: (updates: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // true tant qu'on n'a pas encore ignoré le premier passage de l'effet de
  // sauvegarde suivant le chargement (voir goals-context.tsx pour le même
  // souci : ce passage sauvegarderait des données identiques à ce qui vient
  // d'être lu, donc redondant).
  const skipNextSave = useRef(true);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveSettings(settings);
  }, [settings, loaded]);

  function updateSettings(updates: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...updates }));
  }

  return (
    <SettingsContext.Provider value={{ settings, loaded, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
