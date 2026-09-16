// État partagé des réglages + persistance, même pattern que goals-context.tsx.
// Un contexte séparé plutôt qu'un seul "app state" fourre-tout : Settings et
// Goal n'ont rien en commun et évoluent indépendamment, mais tous deux
// doivent être lisibles depuis plusieurs écrans (ex: le toggle "objectif
// bientôt atteint" de /settings pilote la bannière de /goal/[id]).
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './settingsStorage';
import { useStorageStatus } from './storage-status';

interface SettingsContextValue {
  settings: Settings;
  loaded: boolean;
  updateSettings: (updates: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Contexte de statut séparé, non persisté — AGENTS.md interdit de loger
  // un état transitoire dans Settings, qui le réécrirait sur le disque.
  const { reportLoadResult, reportSaveResult } = useStorageStatus();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // Voir goals-context.tsx : distingue « lecture impossible » de « rien de
  // stocké », et bloque la sauvegarde automatique dans le premier cas.
  const [readFailed, setReadFailed] = useState(false);
  // true tant qu'on n'a pas encore ignoré le premier passage de l'effet de
  // sauvegarde suivant le chargement (voir goals-context.tsx pour le même
  // souci : ce passage sauvegarderait des données identiques à ce qui vient
  // d'être lu, donc redondant).
  const skipNextSave = useRef(true);

  useEffect(() => {
    // loadSettings/saveSettings rattrapent déjà tout en interne (voir
    // settingsStorage.ts : LoadResult à la lecture, booléen à l'écriture)
    // et ne rejettent jamais — .catch() formels, exigés par la règle
    // no-floating-promises.
    loadSettings()
      .then(({ value, ok }) => {
        setSettings(value);
        setReadFailed(!ok);
        setLoaded(true);
        reportLoadResult('settings', ok);
      })
      .catch(() => {});
  }, [reportLoadResult]);

  useEffect(() => {
    if (!loaded) return;
    // Même raison que dans goals-context.tsx : sur échec de lecture, les
    // réglages affichés sont DEFAULT_SETTINGS, pas ceux de l'utilisateur.
    // Les écrire remplacerait sa configuration réelle — encore intacte sur
    // l'appareil — par des valeurs par défaut qu'il n'a jamais choisies
    // (scénario de L2-06 : langue, heure du rappel et toggles perdus au
    // premier réglage touché).
    if (readFailed) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveSettings(settings)
      .then((ok) => reportSaveResult('settings', ok))
      .catch(() => {});
  }, [settings, loaded, readFailed, reportSaveResult]);

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
