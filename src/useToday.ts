// Jour courant pour l'affichage, recalculé quand l'application repasse au
// premier plan.
//
// getGoalStats est pure et reçoit `today` en paramètre (voir stats.ts), et
// les écrans le relisaient via todayStr() à chaque rendu — mais rien ne
// provoquait de rendu au passage de minuit. Une app laissée ouverte, ou
// mise en arrière-plan le soir et rouverte le lendemain, continuait donc
// d'afficher les jours restants, le streak et le statut de la veille
// (L1-08). Écoute AppState plutôt qu'un minuteur dédié : c'est le retour à
// l'écran qui compte, pas l'instant exact du basculement.
//
// À réserver à l'affichage. Une action qui horodate quelque chose doit
// continuer à appeler todayStr() au moment où elle s'exécute — voir
// addProgress dans goals-context.tsx, qui doit dater l'entrée du jour réel
// de l'appui, pas d'un jour mémorisé au dernier rendu.
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { todayStr } from './stats';

export function useToday(): string {
  const [today, setToday] = useState(todayStr);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      // Seul le retour au premier plan est traité : ce qui est rendu
      // pendant une mise en arrière-plan n'est vu par personne.
      if (state !== 'active') return;
      // Quand le jour n'a pas changé, React abandonne la mise à jour sur
      // une valeur identique et ne déclenche aucun rendu.
      setToday(todayStr());
    });
    return () => subscription.remove();
  }, []);

  return today;
}
