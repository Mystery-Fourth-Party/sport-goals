// Jour courant pour l'affichage, recalculé quand l'application repasse au
// premier plan.
//
// getGoalStats est pure et reçoit `today` en paramètre (voir stats.ts) ; lire
// todayStr() à chaque rendu ne suffit pas, car rien ne provoque de rendu au
// passage de minuit. Une app laissée ouverte, ou mise en arrière-plan le
// soir et rouverte le lendemain, continuerait d'afficher les jours restants,
// le streak et le statut de la veille. Écoute AppState plutôt qu'un minuteur
// dédié : c'est le retour à l'écran qui compte, pas l'instant exact du
// basculement.
//
// À réserver à l'affichage et aux décisions qui doivent suivre ce que
// l'écran affiche : GoalsProvider l'utilise pour créer l'occurrence suivante
// d'une série au moment où l'écran considère la précédente comme close (même
// horloge que l'archive). Une action qui horodate quelque chose doit en
// revanche continuer à appeler todayStr() au moment où elle s'exécute — voir
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
