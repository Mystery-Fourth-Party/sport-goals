# Revue — lot 5 : la suite de tests

Périmètre : les 19 fichiers de test du dépôt, 3654 lignes, toutes écrites au
cours de la campagne de correctifs. Base : master à `04df1f8`.

Les lots 1 à 4 prouvaient un défaut par un test rouge. Ce lot-ci porte sur la
suite elle-même, et la question change : non pas « ce code est-il juste ? »
mais « s'il cessait de l'être, un test le verrait-il ? ». Un test rouge ne
peut pas répondre à ça — on ne peut pas écrire un test qui échoue parce qu'un
_autre_ test est faible. La mesure se fait donc à l'envers, par mutation :
casser délibérément une règle de production, relancer toute la suite, et
regarder si quelque chose tombe.

Reproduction : `bash revue/lot-5-mutations.sh` (arbre propre exigé, laissé
propre). Chaque ligne ci-dessous est une exécution complète de la suite.

## Résultat global

**37 mutations, 31 tuées, 6 survivantes.**

Les 31 mutations tuées couvrent les quatre modules purs sous seuil de
couverture, les gardes de persistance des deux contextes, le stockage, et
**chacun des correctifs de la campagne** — L1-02, L1-10, L2-02, L3-01, L3-03,
L4-04, le streak de la veille, l'arrondi anti-epsilon du statut. La règle
d'AGENTS.md « test rouge avant tout correctif » a produit exactement ce
qu'elle promet : là où un bug est passé, il ne repassera pas.

Les 6 survivants se répartissent en trois findings et une paire de mutants
équivalents.

## R5-01 — cinq écrans sur huit n'ont aucun test, dont l'accueil

`app/index.tsx` (327 lignes), `app/create.tsx`, `app/settings.tsx`,
`app/archive.tsx`, `app/_layout.tsx` ne sont importés par aucun fichier de
test. Seuls Détail, Édition et Hebdomadaire en ont un.

| Mutant | Résultat  |
| ------ | --------- |
| `I1`   | SURVIVANT |
| `I2`   | SURVIVANT |

`I1` remplace `data={active}` par `data={completed}` dans la `FlatList` de
l'écran d'accueil : **l'écran principal liste les objectifs terminés au lieu
des objectifs en cours, et les 241 tests passent**. `I2` supprime le libellé
d'accessibilité du titre, posé après le test terrain du 02/09 : personne ne
le voit partir.

Ce n'est pas un oubli isolé mais la règle du projet lue à l'envers : les
écrans testés sont exactement ceux où un bug est remonté (L3-01 sur Édition,
L3-03 sur Hebdomadaire, la garde de chargement sur Détail). Aucun écran n'a
été testé avant d'avoir fait mal.

## R5-02 — un vert qui ne prouve rien dans la passe de référence

`src/stats.timezone.test.ts` protège L1-01 : la base de calendrier des dates
d'objectif. Ses deux tests ne peuvent pas être rouges à UTC+0, et l'en-tête du
fichier le dit. Rien ne le dit à l'exécution.

Mesure — `toDayStr` ramené à son implémentation d'avant la PR #26
(`iso.slice(0, 10)`, c'est-à-dire le bug L1-01 réintroduit) :

| Fuseau       | Résultat                       |
| ------------ | ------------------------------ |
| `TZ=UTC`     | **vert** — le bug n'est pas vu |
| `TZ=EST5EDT` | rouge                          |
| `TZ=GMT-9`   | rouge                          |

La passe `TZ=UTC` est celle qui porte `--coverage` et fait référence ; les
deux autres sont des étapes supplémentaires en `if: ${{ !cancelled() }}`. Si
elles disparaissent — refonte du workflow, contrainte de minutes CI — le
fichier continue d'annoncer « 2 passed » sur du code cassé, et son en-tête
n'empêchera rien.

Sur un poste de développement, la protection dépend du fuseau de la machine :
à Paris, seul le premier des deux tests peut échouer.

## R5-03 — une garde délibérée retirée sans qu'un test tombe, sur un module à 100 %

| Mutant | Résultat  |
| ------ | --------- |
| `M5`   | SURVIVANT |

`stats.ts:88` : `Math.max(0, Math.min(diffDays(start, todayDate), totalDays))`.
Le plancher à 0 protège le cas d'un objectif dont le jour de création est dans
le futur — atteignable par import, `findGoalInconsistency` ne vérifiant pas
que `createdAt` soit passé. Sans lui, `elapsedDays` devient négatif,
`expectedProgress` aussi, et l'en-tête de l'écran Détail affiche « jour -3/30 ».

Ce module est à 100 % de branches pour un seuil à 95 %. Les dix autres
mutations qui y ont été appliquées ont toutes été tuées. Le point n'est pas
que la couverture soit mauvaise ici — elle est excellente — mais qu'elle ne
mesure pas ça : un `Math.max` est un appel de fonction, pas une branche.
Aucun pourcentage de couverture n'aurait signalé ce trou.

## R5-04 — la langue ne tient le planificateur de rappels que par convention

| Mutant | Résultat  |
| ------ | --------- |
| `R1`   | SURVIVANT |

`ReminderScheduler.tsx` liste `i18n.language` dans les dépendances de son
effet pour que le contenu du rappel soit régénéré quand l'utilisateur change
de langue. Retirer cette dépendance ne fait tomber aucun test — et `i18n`,
qui reste dans la liste, ne change pas d'identité à un changement de langue.

À rapprocher de **R2-01** (lot 2) : ce même tableau de dépendances ne contient
pas non plus le jour courant. Deux entrées manquent, l'une n'est tenue par
rien, et c'est le même effet qui décide de ce que l'utilisateur lit le soir.

## Mutants équivalents, non retenus

| Mutant | Résultat  |
| ------ | --------- |
| `E1`   | SURVIVANT |
| `E2`   | SURVIVANT |

Retirer `!loaded ||` de la garde de rendu des écrans Détail et Édition ne fait
tomber aucun test — mais le corps de cette garde conditionne déjà
« Objectif introuvable » à `loaded`, et `E1b`/`E2b`, qui s'attaquent à cette
condition-là, sont tués tous les deux. Les deux écritures ne diffèrent que
si `goals` est non vide avant la fin du chargement : l'état décrit par
**R3-02** (lot 3), et rien d'autre.

Le correctif est donc bien tenu par un test ; le `!loaded ||` en tête est une
duplication défensive, pas ce qui protège l'écran. Signalé pour que la
confrontation ne le compte pas deux fois.

## Ce que ce lot ne mesure pas

Une mutation ne dit rien de ce qu'aucun test n'a _cherché_ à faire. Elle
mesure la solidité des assertions existantes, pas l'imagination qui a
présidé au choix des cas. R2-02 (lot 2) en est l'illustration : le test
« persists an ordinary import exactly once » est solide — `C1` et `C2` sont
tués — et il passe pourtant à côté du cas qui perd une écriture.

---

Addendum : le script `revue/lot-5-mutations.sh` porte depuis le lot 6 deux
mutations supplémentaires (`N2`, `N3`, sur la création du channel Android),
ce qui porte son total à 39 mutations et 7 survivants. Les chiffres de ce
document restent ceux des 37 mutations du lot 5.
