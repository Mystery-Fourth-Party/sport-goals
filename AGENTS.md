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
