# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Principes de conception (rappel)

- État toujours dérivé des données brutes (`entries`), jamais dupliqué ou
  stocké séparément (statuts, compteurs, flags calculables...).
- Pas de backend : persistance locale uniquement (AsyncStorage).
- Toute mise à jour d'état React doit rester pure et dérivée de l'état le
  plus récent (pas de valeur lue depuis une fermeture périmée).
- Logique de calcul/validation pure séparée de l'orchestration native,
  toujours testée.
- État transitoire ou dérivé (erreurs, statuts en cours) : jamais dans un
  contexte auto-persisté comme Settings — un contexte dédié, non sauvegardé,
  si besoin (voir src/reminder-status.tsx).

En cas de doute sur une de ces règles ou sur un cas particulier, demande
avant d'improviser.

# Conventions de revue

Arbitrage du 01/09 sur les méthodes de travail du projet, après le tri des
findings de revue de code.

## Lister les consommateurs, pas seulement le diff

Le corps d'une PR liste explicitement les fichiers **consommateurs** de ce
qui a changé — ce qui importe ou appelle le code modifié — en plus des
fichiers modifiés eux-mêmes. La revue doit pouvoir les ouvrir sans avoir à
les deviner.

Même exigence pour tout test cité comme preuve dans le résumé : le nommer
précisément, pour qu'il soit relu plutôt que pris pour argent comptant. Un
test invoqué sans être vérifié ne prouve rien de plus qu'une affirmation.

## Nommer le mécanisme, ou ne rien affirmer

Ne jamais écrire « vérifié », « garanti », « ceci assure que » — dans un
commentaire de code comme dans un résumé de PR — sans nommer ce qui
l'établit : le nom du test, la commande lancée et son résultat, ou la
capture d'écran.

Sans mécanisme nommé, formuler autrement : dire ce qui a été fait, pas ce
qui est censé en découler.

## Checklists de test manuel

Les checklists de test sur appareil (VoiceOver, TalkBack, notifications
réelles...) vivent dans Notion, jamais dans ce dépôt. Vérifier ce qui
existe déjà avant d'en proposer une nouvelle : le système est organisé par
domaine, avec suivi par cases à cocher.

Ne pas recopier de lien Notion en clair ici — ce dépôt peut devenir public.

## Test rouge avant tout correctif

Tout correctif de bug commence par un test qui reproduit le défaut, vu
rouge sur le code d'avant puis vert après la correction. L'ordre compte :
un test écrit après coup valide le correctif tel qu'il a été fait, pas le
comportement attendu — il passe aussi bien si le correctif est incomplet.

Ce test est commité **séparément** du correctif, et avant lui. Fusionnés
dans un même commit, rien ne permet de vérifier dans l'historique de la PR
que le test échouait vraiment, et la revue doit croire sur parole que
l'ordre a été respecté.
