// Statut de la dernière lecture / écriture sur AsyncStorage — jamais
// persisté, exactement pour la même raison que reminder-status.tsx (voir
// AGENTS.md : un état transitoire n'a rien à faire dans un contexte
// auto-sauvegardé comme Settings, qui réécrirait cet état sur le disque à
// chaque changement). Écrit par GoalsProvider et SettingsProvider, lu par
// StorageStatusBanner.
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

// Les deux zones de stockage de l'app (clés 'goals' et 'settings', voir
// storage.ts et settingsStorage.ts), suivies séparément : chacune a son
// propre cycle lecture/écriture, et une écriture réussie sur l'une ne dit
// rien de l'autre — les confondre effacerait l'échec de sa voisine.
export type StorageArea = 'goals' | 'settings';

type AreaFlags = Record<StorageArea, boolean>;

const NO_FAILURE: AreaFlags = { goals: false, settings: false };

interface StorageStatusContextValue {
  // true dès qu'une zone n'a pas pu être *lue* au démarrage. À distinguer de
  // « rien de stocké » : les données de l'utilisateur sont peut-être encore
  // intactes sur l'appareil, simplement illisibles à cet instant. Les deux
  // providers cessent d'écrire tant que ce drapeau est levé (voir
  // goals-context.tsx / settings-context.tsx).
  loadFailed: boolean;
  // true quand la dernière écriture d'une zone a échoué. Redescend à false
  // dès qu'une écriture ultérieure de cette même zone réussit : c'est un
  // état courant, pas un journal d'incidents.
  saveFailed: boolean;
  reportLoadResult: (area: StorageArea, ok: boolean) => void;
  // Éteint le drapeau de lecture d'une zone sans passer par un résultat de
  // lecture. Une écriture explicite réussie — la restauration d'une
  // sauvegarde, voir replaceAllGoals/importSettings — prouve que le stockage
  // répond de nouveau, et le bandeau ne doit plus annoncer que rien ne sera
  // enregistré. Fonction dédiée plutôt qu'un reportLoadResult(area, true) :
  // rien n'a été relu, et le nom doit le dire.
  clearLoadFailure: (area: StorageArea) => void;
  reportSaveResult: (area: StorageArea, ok: boolean) => void;
}

const StorageStatusContext = createContext<StorageStatusContextValue | null>(null);

export function StorageStatusProvider({ children }: { children: ReactNode }) {
  const [loadFailures, setLoadFailures] = useState<AreaFlags>(NO_FAILURE);
  const [saveFailures, setSaveFailures] = useState<AreaFlags>(NO_FAILURE);

  // useCallback avec une liste de dépendances vide (les setters de useState
  // ont déjà une identité stable) : ces deux fonctions sont listées dans les
  // dépendances de l'effet de sauvegarde de goals-context/settings-context.
  // Recréées à chaque rendu, elles y relanceraient l'effet — donc une
  // écriture sur AsyncStorage — en boucle.
  const reportLoadResult = useCallback((area: StorageArea, ok: boolean) => {
    // Renvoie l'objet précédent tel quel quand le drapeau ne change pas :
    // sans ça, chaque lecture/écriture réussie provoquerait un nouveau rendu
    // de tout l'arbre placé sous ce provider.
    setLoadFailures((prev) => (prev[area] === !ok ? prev : { ...prev, [area]: !ok }));
  }, []);

  const reportSaveResult = useCallback((area: StorageArea, ok: boolean) => {
    setSaveFailures((prev) => (prev[area] === !ok ? prev : { ...prev, [area]: !ok }));
  }, []);

  const clearLoadFailure = useCallback((area: StorageArea) => {
    setLoadFailures((prev) => (prev[area] ? { ...prev, [area]: false } : prev));
  }, []);

  return (
    <StorageStatusContext.Provider
      value={{
        loadFailed: loadFailures.goals || loadFailures.settings,
        saveFailed: saveFailures.goals || saveFailures.settings,
        reportLoadResult,
        reportSaveResult,
        clearLoadFailure,
      }}
    >
      {children}
    </StorageStatusContext.Provider>
  );
}

export function useStorageStatus(): StorageStatusContextValue {
  const ctx = useContext(StorageStatusContext);
  if (!ctx) throw new Error('useStorageStatus must be used within a StorageStatusProvider');
  return ctx;
}
