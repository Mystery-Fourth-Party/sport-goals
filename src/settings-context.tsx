// État partagé des réglages + persistance, même pattern que goals-context.tsx.
// Un contexte séparé plutôt qu'un seul "app state" fourre-tout : Settings et
// Goal n'ont rien en commun et évoluent indépendamment, mais tous deux
// doivent être lisibles depuis plusieurs écrans (ex: le toggle "objectif
// bientôt atteint" de /settings pilote la bannière de /goal/[id]).
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import {
  BackupSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  Settings,
} from './settingsStorage';
import { useStorageStatus } from './storage-status';

interface SettingsContextValue {
  settings: Settings;
  loaded: boolean;
  updateSettings: (updates: Partial<Settings>) => void;
  // Fusionne le rappel quotidien d'une sauvegarde dans les réglages de
  // l'appareil, réservé à la restauration — voir le commentaire sur
  // l'implémentation pour la raison d'être d'une fonction séparée
  // d'updateSettings. Rend false si le rappel n'a pas pu être appliqué.
  importSettings: (imported: Partial<BackupSettings>) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Contexte de statut séparé, non persisté — AGENTS.md interdit de loger
  // un état transitoire dans Settings, qui le réécrirait sur le disque.
  const { reportLoadResult, reportSaveResult, clearLoadFailure } = useStorageStatus();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // Voir goals-context.tsx : distingue « lecture impossible » de « rien de
  // stocké », et bloque la sauvegarde automatique dans le premier cas.
  const [readFailed, setReadFailed] = useState(false);
  // true tant qu'on n'a pas encore ignoré le premier passage de l'effet de
  // sauvegarde suivant le chargement (voir goals-context.tsx pour le même
  // souci : ce passage sauvegarderait des données identiques à ce qui vient
  // d'être lu, donc redondant).
  // Sert aussi à l'import (voir importSettings) : celui-ci écrit lui-même et
  // arme ce drapeau pour que l'effet ne réécrive pas la même valeur derrière
  // lui. Double usage assumé — c'est la même question dans les deux cas,
  // « cette valeur est déjà sur le disque, ne la réécris pas ».
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
    // L'ordre de ces deux gardes est porteur : readFailed doit être testé
    // AVANT skipNextSave, sinon l'import (voir importSettings, qui arme le
    // drapeau puis repasse readFailed à false une fois son écriture
    // réussie) verrait le drapeau consommé au premier passage et
    // provoquerait une seconde écriture au second. Épinglé par le test
    // « persists an ordinary import exactly once » de
    // settings-context.test.tsx.
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

  // Restauration d'une sauvegarde (voir DataSection.tsx, seul appelant).
  // Fonction distincte d'updateSettings, et non un paramètre de celle-ci :
  // updateSettings est appelée par tous les toggles de NotificationsSection
  // et LanguageSection, et lui faire passer readFailed laisserait n'importe
  // quel réglage touché après un échec de lecture écraser les vrais réglages
  // de l'utilisateur par des valeurs par défaut. Ici l'écriture est
  // volontaire et confirmée, et son contenu vient de l'utilisateur — même
  // raisonnement que replaceAllGoals dans goals-context.tsx.
  //
  // Fusionne dans les réglages de l'appareil, relus ici plutôt que pris dans
  // l'état : après un échec de lecture, l'état vaut DEFAULT_SETTINGS alors
  // que les vrais réglages sont intacts sur le disque, et fusionner dessus
  // écraserait langue et interrupteurs par des valeurs par défaut. Si cette
  // relecture échoue aussi, rien n'est écrit ni modifié : le signalement
  // d'échec de lecture reste en place et la fonction rend false.
  // Un `imported` sans aucun réglage ne relit ni n'écrit rien (rend true).
  async function importSettings(imported: Partial<BackupSettings>): Promise<boolean> {
    if (Object.keys(imported).length === 0) return true;
    const { value, ok } = await loadSettings();
    if (!ok) return false;
    const merged: Settings = { ...value, ...imported };
    // Armé avant setSettings, même raison que dans replaceAllGoals.
    skipNextSave.current = true;
    setSettings(merged);
    const saved = await saveSettings(merged);
    reportSaveResult('settings', saved);
    if (saved) {
      setReadFailed(false);
      clearLoadFailure('settings');
    }
    return saved;
  }

  return (
    <SettingsContext.Provider value={{ settings, loaded, updateSettings, importSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
