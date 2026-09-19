# Revue complète de sport-goals — synthèse

**Base** : master à `04df1f8` (merge de la PR #28).
**Branche des preuves** : `revue/preuves-claude`, jamais destinée au merge.
**Auteur de cette passe** : Claude (session Claude Code), en aveugle de la
passe menée en parallèle par Cowork.
**Statut** : 22 findings issus de cette passe, plus 2 confirmés depuis la
passe Cowork — tous mesurés. Aucun correctif écrit. Voir la section 8 pour
les findings venus de Cowork et leur vérification.

Ce document sert de base à la confrontation avec la liste de Cowork. Il
contient la méthodologie employée, le détail de chaque finding avec une piste
de correction _a priori_ — non validée, destinée à découper le travail — et un
jeu de recommandations tirées de ce que la revue a révélé des habitudes du
projet.

---

# 1. Méthodologie

## 1.1 Cadre convenu avant de commencer

Cinq décisions ont été prises avec Pablo avant la première ligne :

1. **Passe neuve sur master courant**, pas une relecture du rapport du 31/08.
   Ce rapport était en lecture seule et déclarait lui-même ses lots 3 et 4
   traités au niveau `medium` seulement.
2. **Deux passes indépendantes** — Claude et Cowork — puis confrontation. Ni
   l'un ni l'autre n'a vu la liste de l'autre pendant sa passe.
3. **Revue exécutante** : chaque finding doit être _prouvé_, pas raisonné.
   Un défaut qu'on ne sait pas faire apparaître n'est pas un finding, c'est
   une hypothèse — et elle doit être présentée comme telle.
4. **Aucun filtrage par axe.** Pas de revue « orientée performance » ou
   « orientée sécurité » : chaque lot reçoit tous les angles.
5. **Lot par lot, avec point d'étape entre chaque.** Pablo valide ou recadre
   avant que le lot suivant ne commence.

## 1.2 Découpage en lots

| Lot | Périmètre                                                        | Volume    |
| --- | ---------------------------------------------------------------- | --------- |
| 1   | Logique pure — `stats`, `backup`, `dateLabels`, `goalValidation` | ~1 100 l. |
| 2   | État & persistance — contextes, stockage, planificateur          | ~900 l.   |
| 3   | Écrans — `app/`                                                  | 1 615 l.  |
| 4   | Composants — `src/components/`                                   | 2 786 l.  |
| 5   | La suite de tests elle-même                                      | 3 654 l.  |
| 6   | Outillage — CI, configs, `app.json`, dépendances, SDK 57         | —         |

Les lots 5 et 6 sont ceux qu'une revue classique ne fait pas : on relit le
code testé, rarement les tests, presque jamais la configuration de build.

## 1.3 Trois régimes de preuve

La nature de la preuve a dû changer selon l'objet du lot.

**A. Test rouge (lots 1 à 4).** Un test qui échoue sur master et décrit le
comportement attendu. C'est le régime le plus fort : il désigne le défaut
_et_ le contrat. Quatre fichiers commités :

```
__tests__/revue-lot-1.test.tsx   00e436a
__tests__/revue-lot-2.test.tsx   6cc867d
__tests__/revue-lot-3.test.tsx   6bf01ba
__tests__/revue-lot-4.test.tsx   7aeb4a9
```

**B. Mutation (lots 5 et 6).** Pour juger la suite de tests, un test rouge ne
sert à rien : on ne peut pas écrire un test qui échoue parce qu'un _autre_
test est faible. La mesure se fait donc à l'envers — casser délibérément une
règle de production, relancer toute la suite, regarder si quelque chose tombe.
Un mutant « survivant » désigne un comportement que rien ne tient.

```
revue/lot-5-mutations.sh    39 mutations, 7 survivants
```

Le script exige un arbre propre, annule chaque mutation par `git checkout --`
et le laisse propre. Il est rejouable à volonté.

**C. Mesure directe (lot 6).** Pour l'outillage, ni l'un ni l'autre : on
exécute et on compare. Typecheck avec et sans les fichiers générés, lecture
du type de couleur PNG dans l'en-tête IHDR, lecture de la source d'un plugin
dans `node_modules`, `expo-doctor`, exécutions de la suite sous trois fuseaux.

## 1.4 Règles que je me suis données

Elles ont toutes été appliquées, et plusieurs m'ont fait rejeter mon propre
travail en cours de route.

- **Prouver sur le code courant, pas sur le souvenir.** Chaque finding a été
  re-vérifié sur `04df1f8`, y compris ceux dont je « savais » qu'ils étaient
  là.
- **Échouer pour la bonne raison.** Un test rouge ne suffit pas : il doit être
  rouge à cause du défaut. Trois tests ont dû être réécrits parce qu'ils
  échouaient pour autre chose — un badge rendu en capitales, un formulaire
  dont le bouton ne s'affichait pas encore, une langue de fixture qui rendait
  le défaut invisible.
- **Ne jamais tester le texte du source.** Un premier test du lot 2 vérifiait
  par `grep` qu'une dépendance figurait dans un tableau. Rejeté et remplacé
  par une preuve comportementale. Même raison au lot 4 : la constante `'20:00'`
  de `GoalFields` n'a pas été « prouvée », parce que la seule façon de le
  faire aurait été d'épingler le littéral.
- **Séparer ce qui est prouvé de ce qui est signalé.** Chaque lot a une
  section « signalé sans preuve », et chaque preuve partielle dit ce qu'elle
  n'établit pas — notamment pour l'accessibilité, où RNTL n'émule pas ce
  qu'un lecteur d'écran annonce.
- **Documenter les pistes écartées.** Une dizaine de suspects ont été
  examinés puis rejetés, avec la raison. Ils figurent dans les comptes rendus
  de lot ; ils comptent pour la confrontation, puisqu'un désaccord avec
  Cowork portera peut-être sur l'un d'eux.
- **Nommer le mécanisme ou ne rien affirmer** (règle d'AGENTS.md). Appliquée
  à mes propres conclusions : là où le comportement dépend d'un appareil que
  personne n'a testé (VoiceOver, apparence d'une notification, écran de
  démarrage), c'est écrit.

## 1.5 Ce que la méthode ne voit pas

À dire à Cowork, parce que ça délimite ce que cette liste vaut :

- **Une mutation mesure la solidité des assertions existantes, pas
  l'imagination du choix des cas.** R2-02 l'illustre : le test
  « persists an ordinary import exactly once » résiste à deux mutations
  dirigées contre lui, et passe pourtant à côté du cas qui perd une écriture.
- **Aucun test sur appareil.** Tout ce qui ne se voit qu'au build (apparence
  de la notification, écran de démarrage, annonce réelle d'un lecteur
  d'écran) est signalé comme à confirmer.
- **Aucune revue de la performance en conditions réelles.** Rien n'a été
  profilé ; le volume de données de l'app rend le sujet marginal, mais ce
  n'est pas une mesure.
- **Aucune revue du prototype Figma contre l'implémentation.** Hors cadre
  convenu.

## 1.6 Traçabilité

```
00e436a  revue(lot 1): preuves des trois findings de logique pure
6cc867d  revue(lot 2): preuves des deux findings d'état et persistance
6bf01ba  revue(lot 3): preuves des deux findings d'écrans
7aeb4a9  revue(lot 4): preuves des quatre findings de composants
e1fc55f  revue(lot 5): mesure de la suite de tests par mutation
39dd9c3  revue(lot 6): mesures d'outillage, CI et conformité SDK 57
```

Rapports détaillés : `revue/lot-5-resultats.md`, `revue/lot-6-resultats.md`.
Les lots 1 à 4 sont documentés dans les en-têtes de leurs fichiers de test.

---

# 2. Tableau récapitulatif

| ID    | Titre court                                            | Site principal                            | Gravité | Preuve   |
| ----- | ------------------------------------------------------ | ----------------------------------------- | ------- | -------- |
| R1-01 | Streak à 0 présenté comme un encouragement             | `GoalCard.tsx` + `stats.ts:calcStreak`    | Moyenne | rouge    |
| R1-02 | Exigence non nulle affichée « 0 »                      | `stats.ts:fmt`                            | Moyenne | rouge    |
| R1-03 | Libellé d'unité de l'export dépendant de la langue     | `backup.ts:buildBackupPayload`            | Basse   | rouge    |
| R2-01 | Rappel quotidien non régénéré au changement de jour    | `ReminderScheduler.tsx`                   | Moyenne | rouge    |
| R2-02 | Écriture perdue après un import sur échec de lecture   | `goals-context.tsx`                       | Haute   | rouge    |
| R3-01 | État vide affirmé avant chargement                     | `archive.tsx`, `weekly.tsx`, `create.tsx` | Moyenne | rouge    |
| R3-02 | Le chargement initial écrase l'état en mémoire         | `goals-context.tsx:97`                    | Basse   | rouge    |
| R4-01 | 100 % affiché sur un objectif non complété             | `GoalCard.tsx`, `GoalProgressCard.tsx`    | Moyenne | rouge    |
| R4-02 | Sélecteur d'heure sans libellé d'accessibilité         | `ui/TimeField.tsx`                        | Moyenne | rouge    |
| R4-03 | Libellés de jour ambigus sur « Dernières séances »     | `RecentSessionsCard.tsx`                  | Basse   | rouge    |
| R4-04 | Feuille du modal exposée comme un seul élément         | `ProgressEntryModal.tsx:81`               | Basse   | rouge    |
| R5-01 | Cinq écrans sur huit sans aucun test                   | `app/index.tsx` en tête                   | Moyenne | mutation |
| R5-02 | Un vert qui ne prouve rien dans la passe de référence  | `stats.timezone.test.ts`                  | Basse   | mesure   |
| R5-03 | Garde délibérée retirable sans qu'un test tombe        | `stats.ts:88`                             | Basse   | mutation |
| R5-04 | La langue ne tient le planificateur que par convention | `ReminderScheduler.tsx`                   | Basse   | mutation |
| R6-01 | La CI typecheck un programme plus faible               | `.github/workflows/ci.yml`                | Moyenne | mesure   |
| R6-02 | Toute la suite tourne en `Platform.OS === 'ios'`       | `package.json` (preset jest)              | Moyenne | mutation |
| R6-03 | Icône de notification Android non configurée           | `app.json`                                | Moyenne | mesure   |
| R6-04 | Écran de démarrage jamais configuré                    | `app.json`                                | Moyenne | mesure   |
| R6-05 | « Objectif atteint » hors du channel de l'app          | `notifications.ts:281`                    | Basse   | lecture  |
| R6-06 | Dérive SDK non surveillée (12 paquets)                 | CI / `package-lock.json`                  | Basse   | mesure   |
| R6-07 | Version de Node de la CI non figée                     | `.github/workflows/ci.yml`                | Basse   | mesure   |

**Gravités** : Haute 1 · Moyenne 10 · Basse 11. Deux findings supplémentaires
(`RC-A`, `RC-B`) viennent de la passe Cowork — section 8.

---

# 3. Findings et pistes de correction _a priori_

Chaque piste est une direction, pas une décision. Les points marqués
**[produit]** demandent un arbitrage avant tout code.

## R1-01 — Streak à 0 présenté comme un encouragement · Moyenne

`calcStreak(entries, today)` rompt dès que le jour courant n'a pas d'entrée,
c'est-à-dire toute la journée jusqu'au premier enregistrement. La carte
« en avance » affiche donc « 🔥 0 jour consécutif » comme encouragement.

**Piste** : `notifications.ts` a rencontré exactement ce problème et l'a résolu
en calculant le streak à la veille (`buildReminderContent`). Étendre ce
traitement au chemin d'affichage — soit en exposant un second champ
(`displayStreak`) sur `GoalStats`, soit en décalant `calcStreak` d'un jour
quand le jour courant est vide. **[produit]** : faut-il afficher « 4 jours »
le matin avant d'avoir logé, ou masquer l'encouragement tant que le streak
est à 0 ? Les deux sont défendables ; la seconde est moins flatteuse mais
plus honnête.

## R1-02 — Exigence non nulle affichée « 0 » · Moyenne

`fmt` arrondit à l'entier pour `reps`, `min` et `h` : toute valeur dans
`]0 ; 0,5[` devient « 0 ». Deux sites vivants — la carte « Rythme quotidien
requis » de la Création et la colonne « Requis » de `GoalProgressCard`.

**Piste** : introduire un plancher d'affichage dans `fmt`, ou une variante
`fmtRequirement` : en dessous de 1, rendre une décimale (« 0,2 ») ou la
mention « < 1 ». Attention à ne pas casser les autres appelants de `fmt`, qui
affichent des totaux où l'entier est le bon format. **[produit]** : décimale
ou « < 1 ».

## R1-03 — Libellé d'unité de l'export dépendant de la langue · Basse

`buildBackupPayload` écrit `unitLabel: i18n.t(\`unit.${goal.unit}\`)`, alors
que l'en-tête du module annonce un format « documenté et figé pour être
directement exploitable par un outil externe ». Le même objectif exporté en
français puis en anglais produit deux fichiers différents, sans que rien dans
le fichier ne dise quelle langue a servi.

**Piste** : le champ `unit` (canonique) est déjà dans la charge utile.
Supprimer `unitLabel`, ou le figer sur une table constante indépendante d'i18n.
Sans conséquence à la réimportation — `parseBackupPayload` ignore ce champ.
Penser à `SCHEMA_VERSION` si le champ disparaît. **[produit]** : suppression
ou libellé canonique.

## R2-01 — Rappel quotidien non régénéré au changement de jour · Moyenne

L'effet de `ReminderScheduler` dépend des objectifs, de trois réglages, des
deux drapeaux `loaded` et de la langue — jamais du jour. La variante « série
en danger » reste donc celle de la veille : elle peut nommer un objectif
désormais complété ou annoncer un compte de jours périmé.

**Piste** : `useToday()` existe déjà (posé en PR4 pour exactement ce problème
côté affichage) et s'abonne à `AppState`. L'appeler dans `ReminderScheduler`
et ajouter sa valeur aux dépendances de l'effet. Le planificateur cesse alors
d'appeler `todayStr()` en interne. Corrige mécaniquement **R5-04** au passage
si le test correspondant est écrit.

## R2-02 — Écriture perdue après un import sur échec de lecture · **Haute**

`replaceAllGoals` arme `skipNextSave` puis écrit lui-même. Quand `readFailed`
est vrai, l'effet de sauvegarde retourne _avant_ de consommer le drapeau, qui
reste donc armé pendant toute l'écriture. Une modification faite par
l'utilisateur pendant ce temps est sautée : elle n'atteint jamais le disque et
disparaît au redémarrage.

`skipNextSave` saute « le prochain passage de l'effet », pas « la valeur déjà
écrite ». Dès qu'un passage s'intercale, il protège la mauvaise.

**Piste** : remplacer le drapeau par une **garde par référence** — mémoriser
dans un ref le tableau exactement écrit par `replaceAllGoals`, et ne sauter
l'écriture automatique que si `goals === lastWrittenRef.current`. Toute autre
valeur, y compris une modification intercalée, est alors écrite normalement.
C'est la solution qui avait été proposée en revue de PR2 et écartée au motif
qu'un test épinglerait le risque résiduel : ce test existe, il ne couvre pas
ce cas. À rouvrir avec Cowork.

`settings-context.tsx` porte la même structure et donc le même défaut ; le
correctif doit couvrir les deux.

## R3-01 — État vide affirmé avant chargement · Moyenne

La garde `loaded` n'a jamais été posée par principe, mais écran par écran, à
mesure que les bugs remontaient : `index.tsx` depuis l'origine, `edit.tsx`
depuis la PR #25, `goal/[id].tsx` depuis la PR #28. `archive.tsx`,
`weekly.tsx` et `create.tsx` ne la lisent toujours pas. Sur Archive,
« Aucun objectif terminé » s'affiche pendant le chargement, sur une archive
qui en contient.

**Piste** : plutôt que d'ajouter la garde à trois endroits de plus, poser
l'invariant une fois — un composant `<GoalsGate>` (ou un hook
`useGoalsOrNull()`) que tout écran lisant `goals` doit traverser, et qui rend
l'état de chargement. Ça rend la règle visible pour le prochain écran écrit,
ce que trois `if` de plus ne feraient pas. Voir la recommandation 1.

## R3-02 — Le chargement initial écrase l'état en mémoire · Basse

L'effet de chargement fait `setGoals(value)` sans regarder ce que `goals`
contient déjà. Un objectif créé avant la résolution est perdu — et l'effet de
sauvegarde, gardé par `if (!loaded) return`, ne l'a pas écrit entre-temps :
il n'existe plus nulle part.

Troisième manifestation de la même cause, nommée et non prouvée séparément :
`DataSection` lit `goals` sans `loaded` pour construire l'export. Un export
déclenché dans cette fenêtre produit un **fichier de sauvegarde vide** que
l'utilisateur conserve en croyant avoir une copie.

**Piste** : deux volets. (a) Empêcher d'atteindre les actions avant la fin du
chargement — c'est la correction de R3-01, qui ferme la porte d'entrée
principale (`create.tsx`) et le cas de l'export vide. (b) Rendre l'écrasement
impossible par construction : fusionner plutôt qu'écraser, ou ignorer le
résultat de la lecture si l'état a déjà été modifié. Le (b) seul laisse la
fenêtre ouverte sur l'export ; le (a) seul laisse le mécanisme en place.

## R4-01 — 100 % affiché sur un objectif non complété · Moyenne

`GoalCard` et `GoalProgressCard` rendent `(s.progress * 100).toFixed(0)`.
Au-delà de 99,5 %, « 100% » s'affiche pendant que `StatusBadge` dit
« EN COURS » dans la même vue. `ProgressBar` porte le même nombre dans son
`accessibilityValue.text`.

**Piste** : une fonction unique `formatProgressPercent(progress, status)`
partagée par les trois sites, qui plafonne à 99 tant que `status !== 'completed'`
(et symétriquement plancher à 1 dès que la progression est non nulle). Chemin
de code distinct de `fmt` : corriger R1-02 ne corrige pas celui-ci.

## R4-02 — Sélecteur d'heure sans libellé d'accessibilité · Moyenne

`TimeField` est le seul contrôle dont l'enfant est une _valeur_ et non un nom :
sur Android il s'annonce « 20:00, bouton ». Ses deux appelants laissent à côté
un `Text` visible, non masqué, qui forme un arrêt de navigation séparé — alors
que les trois lignes juste au-dessus dans `GoalFields` appliquent le motif
inverse.

**Piste** : rendre `accessibilityLabel` **obligatoire** dans les props de
`TimeField` (comme `Toggle` l'a fait, avec le même commentaire justificatif),
le poser sur les trois branches de plateforme, et masquer le `Text` voisin
chez les deux appelants. Le caractère obligatoire est ce qui empêche le
prochain appelant de l'oublier.

## R4-03 — Libellés de jour ambigus sur « Dernières séances » · Basse

La carte prend les 7 dernières _séances_, qui peuvent s'étaler sur des mois,
et les étiquette par jour de la semaine. Un utilisateur qui s'entraîne le
lundi voit « lun, lun, lun ». La carte étant masquée au lecteur d'écran, le
libellé visible est le seul canal.

**Piste** : deux options exclusives. (a) Changer le libellé pour une date
courte (« 14/09 ») — la carte reste « les 7 dernières séances ». (b) Changer
la série pour les 7 derniers _jours_, comme le graphique hebdomadaire — le
libellé jour devient exact, mais la carte peut être vide pour un utilisateur
irrégulier. **[produit]**, et c'est un arbitrage de design, pas de code.

## R4-04 — Feuille du modal exposée comme un seul élément · Basse

`Pressable` pose `accessible: accessible !== false`. La feuille du modal de
progression est un `Pressable` — uniquement pour que le tap dessus ne referme
pas le modal — et contient le champ, les deux boutons et le lien de
suppression. Le commentaire du backdrop, deux lignes plus haut, tient
exactement ce raisonnement et pose `accessible={false}` ; la feuille ne l'a
pas reçu.

**Piste** : `accessible={false}` sur la feuille, ou remplacer le `Pressable`
par une `View` avec `onStartShouldSetResponder={() => true}`, qui bloque la
propagation sans se déclarer accessible. À confirmer sous VoiceOver — le
regroupement est franc sous iOS, plus nuancé sous TalkBack, et **aucun test
iOS n'a jamais eu lieu sur ce projet**.

## R5-01 — Cinq écrans sur huit sans aucun test · Moyenne

`app/index.tsx` (327 l.), `create.tsx`, `settings.tsx`, `archive.tsx`,
`_layout.tsx` ne sont importés par aucun test. Mesuré : remplacer
`data={active}` par `data={completed}` fait lister les objectifs _terminés_
sur l'écran d'accueil, et les 241 tests passent.

**Piste** : un test de fumée par écran — il se monte, il affiche ses éléments
structurants, ses actions principales partent. Commencer par `index.tsx`. Ce
n'est pas une couverture exhaustive, c'est le filet qui manque : les deux
mutations survivantes auraient été tuées par dix lignes de test.

## R5-02 — Un vert qui ne prouve rien dans la passe de référence · Basse

Mesuré, bug L1-01 réintroduit : `TZ=UTC` **vert**, `TZ=EST5EDT` rouge,
`TZ=GMT-9` rouge. La passe UTC est celle qui porte `--coverage` et fait
référence ; les deux autres sont des étapes en `if: ${{ !cancelled() }}`.

**Piste** : rendre la vacuité bruyante à l'exécution. Une garde en tête de
fichier — si `new Date().getTimezoneOffset() === 0`, marquer les deux tests
`skip` avec un message explicite plutôt que de les laisser passer. Un
`2 skipped` dit la vérité, un `2 passed` ment.

## R5-03 — Garde délibérée retirable sans qu'un test tombe · Basse

Le plancher `Math.max(0, …)` sur `elapsedDays` (`stats.ts:88`) protège le cas
d'un objectif dont le jour de création est dans le futur — atteignable par
import, `findGoalInconsistency` ne vérifiant pas que `createdAt` soit passé.
Le module est à 100 % de branches : un `Math.max` n'est pas une branche.

**Piste** : deux volets. (a) Un test sur un objectif à `createdAt` futur. (b)
Décider si l'import doit l'accepter du tout — si la réponse est non, la règle
rejoint `findGoalInconsistency` et le plancher devient une défense en
profondeur, qui mérite quand même son test. **[produit]** pour (b).

## R5-04 — La langue ne tient le planificateur que par convention · Basse

Retirer `i18n.language` des dépendances de l'effet ne fait tomber aucun test,
et `i18n`, qui reste dans la liste, ne change pas d'identité à un changement
de langue.

**Piste** : un test « changement de langue → reprogrammation avec le contenu
traduit ». À écrire avec celui de R2-01, qui touche le même tableau de
dépendances — les deux entrées manquantes ou non tenues sont sur le même
effet.

## R6-01 — La CI typecheck un programme plus faible · Moyenne

`.expo/types/router.d.ts` et `expo-env.d.ts` sont référencés par `tsconfig.json`
et ignorés par `.gitignore`. Aucune étape du workflow ne les régénère. Mesuré :
un `router.push()` vers une route inexistante donne `TS2345` sur le poste de
dev et **exit 0** dans les conditions de la CI.

**Piste** : ajouter une étape qui régénère les types avant le typecheck
(`npx expo customize tsconfig.json` ou l'équivalent documenté pour SDK 57 —
à vérifier dans la doc versionnée), ou commiter les deux fichiers générés en
assumant leur maintenance. La première option est la bonne si la commande
existe sans démarrer de serveur. **[à trancher]**, et c'est le finding avec
le meilleur rapport valeur/effort de la liste.

## R6-02 — Toute la suite tourne en `Platform.OS === 'ios'` · Moyenne

Onze branches `Platform.OS` vivent dans le dépôt ; sous iOS, ne sont jamais
exécutées : le sélecteur d'heure Android et son repli web, l'export/import
web, le repli web de `confirmDestructive`, et **la création du channel de
notifications Android**, sans lequel aucune notification ne s'affiche sur
Android 8+. Mutation `N2` (neutraliser l'appel) : survivante. Le projet n'est
testé sur appareil que sous Android.

**Piste** : passer à `jest-expo/universal` (quatre projets : ios, android,
web, node), ou au minimum ajouter un second projet Android. Attention : ça
multiplie le temps de CI et fera probablement apparaître des tests à adapter.
Étape intermédiaire raisonnable : basculer le preset sur `jest-expo/android`
— la plateforme réellement livrée — et garder iOS pour plus tard.

## R6-03 — Icône de notification Android non configurée · Moyenne

`"expo-notifications"` est listé en chaîne nue, donc sans `icon`. Android ne
lit que le canal alpha d'une petite icône. Mesuré : `assets/icon.png` est en
**type PNG 2 (RGB), sans canal alpha du tout** → aplat blanc dans la barre
d'état. `assets/android-icon-monochrome.png` est en RGBA.

**Piste** :

```json
[
  "expo-notifications",
  {
    "icon": "./assets/android-icon-monochrome.png",
    "color": "#FF6B00"
  }
]
```

À valider sur un build EAS preview — et à ajouter à une checklist Notion, qui
ne couvre aujourd'hui que le _déclenchement_ de la notification, pas son
apparence.

## R6-04 — Écran de démarrage jamais configuré · Moyenne

Source du plugin lue dans `node_modules` : sans props, `withSplashScreen` ne
fait **rien**, sur aucune plateforme. `assets/splash-icon.png` n'est référencé
nulle part. Et `_layout.tsx` retient délibérément ce splash le temps de
charger les polices — le soin pris à éviter un flash de polices tient un
écran qui n'a jamais été habillé, sur une app entièrement sombre.

**Piste** :

```json
[
  "expo-splash-screen",
  {
    "image": "./assets/splash-icon.png",
    "backgroundColor": "<colors.appBg>",
    "imageWidth": 200
  }
]
```

À faire en même temps que R6-03 : même fichier, même validation par build.

## R6-05 — « Objectif atteint » hors du channel de l'app · Basse

`sendGoalReachedNotification` programme avec `trigger: null` et sans
`channelId`, là où le rappel quotidien pose `channelId: 'reminders'`. Les deux
notifications de l'app ne partagent pas le même channel, et les réglages
système appliqués à « Rappels et objectifs » ne concernent pas la célébration.

**Piste** : ajouter `channelId` au contenu. **[produit]** mineur : un seul
channel pour les deux, ou un second channel « Célébrations » que
l'utilisateur puisse couper séparément — ce qui ferait doublon avec le réglage
in-app `goalReachedNotifs`.

## R6-06 — Dérive SDK non surveillée · Basse

`expo-doctor` : 20 vérifications sur 21 passent, la seule en échec étant
l'alignement — **12 paquets en retard**, dont `expo-notifications`,
`expo-router` et `expo` lui-même. Les plages `~57.0.x` l'autoriseraient ;
c'est le lock, réinstallé à l'identique par `npm ci`, qui fige.

**Piste** : une étape `npx expo install --check` en CI (elle sort en erreur
quand ça dérive), plus un `npx expo install --fix` ponctuel pour rattraper les 12. Faire le rattrapage **avant** d'ajouter la garde, sinon la CI est rouge
dès le premier commit.

## R6-07 — Version de Node de la CI non figée · Basse

`node-version: lts/*`, pas de `.nvmrc`, pas d'`engines`. La stratégie de test
des fuseaux repose sur un comportement propre à la version de Node —
`process.env.TZ` posé _dans_ jest ne déplace plus l'horloge.

**Piste** : figer une majeure (`node-version: 22`), ajouter un `.nvmrc` et un
champ `engines`, et faire de la montée de version un changement délibéré.

---

# 4. Signalé sans preuve

Ces points sont réels mais n'ont pas reçu de preuve exécutable, pour une
raison qui est donnée à chaque fois. Ils appartiennent quand même à la
confrontation.

| Point                                                                                                                                    | Pourquoi pas de preuve                                                                                            | Piste                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GoalFields:200` pose `'20:00'` en dur à l'activation de « Horaire personnalisé », au lieu de partir de l'horaire global qu'il surcharge | `GoalFields` ne connaît pas les réglages : prouver l'attendu demanderait d'ajouter la prop qui _est_ le correctif | Nouvelle prop `inheritedReminderTime`, fournie par les deux écrans appelants                         |
| `DateTimePicker` émet `onChange is deprecated. Use onValueChange, onDismiss, and onNeutralButtonPress` à chaque rendu                    | Avertissement de bibliothèque, pas un comportement de l'app                                                       | Migrer `TimeField` vers la nouvelle API, en même temps que R4-02                                     |
| `Number('2,5')` vaut `NaN` et un clavier numérique français propose la virgule                                                           | Le clavier n'est pas observable depuis les tests                                                                  | Normaliser la virgule en point à la saisie — **[produit]** : faut-il accepter des cibles décimales ? |
| Rien ne garantit la parité des clés fr/en                                                                                                | Aucun écart aujourd'hui (190 clés de chaque côté, placeholders et pluriels concordants) : un test serait vert     | Un test de parité, écrit maintenant qu'il est vert, pour qu'il devienne rouge au premier oubli       |
| `collectCoverageFrom` porte sur 4 fichiers sur une quarantaine                                                                           | Constat de configuration                                                                                          | Élargir, avec des seuils différenciés — sinon la barre tombe à un niveau qui ne dit plus rien        |
| `npm run lint` sans `--max-warnings 0` ; un avertissement survit depuis le début                                                         | Constat de configuration                                                                                          | Ajouter le drapeau après avoir traité l'avertissement existant                                       |
| `ios.bundleIdentifier` absent alors qu'`android.package` est posé                                                                        | Sans conséquence tant qu'aucun build iOS n'est lancé                                                              | À décider plutôt qu'à subir                                                                          |

---

# 5. Découpage proposé du travail

Six chantiers, regroupés par nature de compétence et de validation plutôt que
par gravité. L'ordre entre chantiers est indicatif ; **A** conditionne la
confiance dans tout le reste.

**A. Filet de sécurité** — R6-01, R6-06, R6-07, R5-02
Rendre la CI honnête avant de corriger quoi que ce soit. Rien ici ne touche
au comportement de l'app ; tout ici change ce qu'un vert signifie. Le
rattrapage des 12 paquets se fait dans ce chantier, avant la garde.

**B. Persistance et cycle de vie d'un objectif** — R2-02, R3-02, R3-01, RC-A
Le seul finding de gravité haute et ses voisins. Un seul chantier parce que
R3-01 et R3-02 se corrigent ensemble (voir leurs pistes) et que R2-02 touche
le même fichier. Demande une revue serrée : c'est là qu'on perd des données.

**C. Affichage des nombres** — R4-01, R1-02, R1-01
Trois arrondis et un encouragement, tous purs, tous dans `stats.ts` et ses
appelants directs. Trois arbitrages produit à trancher d'un coup. Chantier
idéal pour du travail en parallèle : logique pure, entièrement testable.

**D. Accessibilité** — R4-02, R4-04, plus la migration `DateTimePicker`
Même famille que L4-01/L4-03/L4-04 déjà traités. Exige une validation sur
appareil, et c'est l'occasion de faire **le premier test iOS du projet**.

**E. Configuration native** — R6-03, R6-04, R6-05
Trois lignes de `app.json` et une de `notifications.ts`, mais aucune
validable autrement que par un build EAS preview. À grouper pour n'en faire
qu'un.

**F. Filet de tests** — R5-01, R6-02, R5-03, R5-04, R1-03, R4-03, RC-B
Le reste : tests de fumée des cinq écrans, plateforme jest, les deux mutants
survivants restants, et les deux findings d'affichage isolés.

---

# 6. Recommandations

Tirées de ce que la revue a révélé, pas de bonnes pratiques génériques.
Chacune répond à un motif observé plusieurs fois.

## 6.1 Poser l'invariant, pas le correctif ponctuel

**Motif observé** : la garde `loaded` ajoutée à trois écrans par trois PR
différentes, chaque fois en réaction à un symptôme (R3-01). Les libellés
d'accessibilité posés partout sauf sur `TimeField` (R4-02). Les écrans testés
exactement là où un bug est remonté (R5-01). Trois fois le même réflexe.

**Recommandation** : quand un correctif appartient à une _classe_, la PR doit
faire trois choses — corriger le site qui a fait mal, balayer les autres sites
de la même classe, et rendre la règle difficile à oublier pour le prochain
(prop obligatoire, composant traversant, type qui ne compile pas sans). Une
PR qui ne fait que la première est incomplète, même quand son test est vert.

Concrètement, une ligne à ajouter au corps de PR : « autres sites de la même
classe : … / mécanisme qui empêche l'oubli suivant : … ».

## 6.2 Vérifier la revendication d'un test avant de s'appuyer dessus

**Motif observé** : R2-02 est né d'une décision de revue — conserver
`skipNextSave` plutôt qu'une garde par référence — prise au motif qu'un test
« neutraliserait le risque résiduel ». Ce test existe, il est solide (deux
mutations dirigées contre lui sont tuées), et il ne couvre pas le cas. La
décision était raisonnable et fausse.

**Recommandation** : quand un arbitrage de revue s'appuie sur l'existence d'un
test, **ouvrir le test et citer l'assertion**. Pas le nom du test : la ligne
qui assert. C'est l'extension naturelle de la règle d'AGENTS.md « nommer le
mécanisme, ou ne rien affirmer » — appliquée aux décisions de revue, pas
seulement aux commentaires de code.

## 6.3 Ce que les tests n'exécutent pas doit être écrit quelque part

**Motif observé** : la suite tourne en iOS sur un projet livré sur Android
(R6-02), et personne ne le savait. Deux tests de fuseau ne peuvent pas échouer
dans la passe de référence (R5-02), et seul un commentaire le dit.

**Recommandation** : un test qui ne peut pas échouer doit le dire à
l'exécution, pas dans un commentaire — `skip` bruyant plutôt que `pass`
silencieux. Et la plateforme sur laquelle la suite tourne fait partie des
choses à décider explicitement, pas à hériter d'un preset.

## 6.4 Une configuration déclarée n'est pas une configuration appliquée

**Motif observé** : deux plugins listés dans `app.json` qui ne font rien
(R6-03, R6-04), un asset (`splash-icon.png`) qui n'est référencé nulle part,
et un typecheck qui vérifie un programme plus faible en CI que sur le poste de
dev (R6-01). Aucun de ces trois n'apparaît dans un diff : il n'y a rien à voir
dans le diff, c'est justement le problème.

**Recommandation** : toute entrée de `app.json`, tout plugin, toute option de
build doit avoir été **observée en effet** au moins une fois — dans un build,
dans un `prebuild`, dans une capture. Et la CI doit exécuter le même programme
que le poste de développement : tout fichier référencé par `tsconfig.json` et
absent de la CI est un écart à traiter, pas un détail.

## 6.5 Mesurer la solidité des tests, pas seulement leur couverture

**Motif observé** : `stats.ts` est à 100 % de branches pour un seuil à 95 %,
et une garde délibérée peut en être retirée sans qu'un test tombe (R5-03) —
parce qu'un `Math.max` n'est pas une branche. À l'inverse, l'écran d'accueil
n'a aucune couverture _mesurée_ et aucune couverture _réelle_ (R5-01), et rien
ne l'annonçait.

**Recommandation** : rejouer `revue/lot-5-mutations.sh` après chaque gros
chantier, et y ajouter une mutation quand un correctif pose une garde. Un
mutant survivant est une information que la couverture ne donne jamais. Et
élargir `collectCoverageFrom` à tout `src/` et `app/` — avec des seuils
différenciés, pour que le chiffre reste lisible.

## 6.6 Ce qui n'existe que sur l'appareil doit avoir sa checklist

**Motif observé** : l'apparence de la notification (R6-03), l'écran de
démarrage (R6-04), le regroupement d'accessibilité sous VoiceOver (R4-04) —
trois choses invisibles depuis un test, dont deux sont cassées depuis
l'origine. Les checklists Notion existantes couvrent le _déclenchement_ de la
notification, pas son apparence. Et aucun test iOS n'a jamais eu lieu sur ce
projet.

**Recommandation** : quand une PR touche à quelque chose dont le rendu ne se
voit qu'au build, elle ouvre une entrée de checklist Notion — même si
personne ne la fera tout de suite. Le coût est d'une ligne ; l'alternative
est un carré blanc dans la barre d'état pendant six mois.

## 6.7 Faire des revues qui traversent les PR

**Motif observé** : R2-02 naît de l'interaction entre un correctif de PR2 et
une porte de sortie ajoutée en PR5 — chacune relue isolément, chacune correcte
isolément. Aucune revue de diff ne pouvait l'attraper. C'est aussi vrai des
trois findings d'outillage, qui portent sur du code dont le diff ne montre
rien.

**Recommandation** : garder le principe de cette revue — une passe périodique
sur l'état du dépôt, pas sur les changements — et la traiter comme un livrable
à part entière : lots, preuves, branche dédiée. La cadence (après chaque
campagne de correctifs ? tous les N PR ?) est à décider, mais l'exercice a
trouvé ce qu'aucune des huit revues de PR n'avait vu.

---

# 7. Ce qui reste ouvert

- **PR7 / L3-02** (conversion d'unités) est toujours bloquée sur un arbitrage
  produit, indépendamment de cette revue.
- **Règles de construction du fichier de sauvegarde** à documenter pour
  l'utilisateur — décidé avec Pablo pendant la PR5, à reprendre avec Cowork.
- **Checklist de test sur appareil pour l'accessibilité ajoutée en PR #28** :
  le libellé du graphique hebdomadaire n'a jamais été validé sur appareil.
- **La confrontation elle-même** : cette liste est une passe sur deux. Les
  écarts — findings vus par l'un et pas l'autre, désaccords de gravité,
  pistes écartées par l'un et retenues par l'autre — sont l'information la
  plus utile que produira l'exercice.

---

# 8. Findings remontés par la passe Cowork

Addendum écrit après la comparaison des deux listes sur la page Notion
« Revue profonde — comparaison des findings ». Cowork signale trois findings
absents de mes 22, en précisant qu'aucun n'a le régime de preuve « test
rouge » des lots 1 à 4, et demande qu'ils y passent avant d'être intégrés à
un chantier.

Preuves : `__tests__/revue-cowork.test.tsx`. Deux findings sur trois sont
confirmés et prouvés ; le troisième est reclassé.

## RC-A — échéance déplacée en corrigeant un autre champ · **Confirmé, Moyenne**

Site : `app/goal/[id]/edit.tsx:74`.

Le champ « Jours restants » s'initialise sur `String(Math.max(1, s.remainingDays))`,
et `handleSave` recalcule **toujours** l'échéance à partir de ce champ.

Pour un objectif en cours, les deux se compensent exactement : `remainingDays`
vaut `diffDays(aujourd'hui, échéance)`, donc réécrire `aujourd'hui + remainingDays`
retombe sur le même jour. **Ne pas déplacer l'échéance quand on ne touche pas
à la durée est donc la norme de cet écran** — un second test le constate et
il passe.

Pour un objectif dépassé, `remainingDays` vaut 0 et le plancher à 1 casse la
compensation.

**Mesuré** — objectif à échéance au 2026-09-16 (dépassée de 3 jours), statut
`late`, `remainingDays` à 0 ; on change **uniquement le titre** et on
enregistre :

| Attendu      | Obtenu         |
| ------------ | -------------- |
| `2026-09-16` | **2026-09-20** |

L'échéance est repoussée à demain et l'objectif cesse d'être en retard —
statut, bannière, rythme requis et carte « le plus en retard » du résumé
hebdomadaire suivent.

**Ce que la piste de Cowork ne dit pas encore** : le plancher n'est pas
gratuit. `parseDurationDays` refuse 0, donc sans lui un objectif dépassé ne
pourrait plus être édité du tout sans saisir une nouvelle durée. L'arbitrage
porte sur les deux ensemble, pas sur le plancher seul. Piste retenue : ne
dériver l'échéance du champ durée que si l'utilisateur l'a effectivement
modifié — ce qui règle aussi le cas général, où réécrire l'échéance à chaque
enregistrement ne sert à rien.

Rejoint le **chantier B**.

## RC-B — le résumé hebdomadaire couronne un objectif terminé · **Confirmé, Moyenne**

Site : `app/weekly.tsx:22` / `stats.ts:getWeeklyStats`.

`weekly.tsx` passe `goals` sans filtrer, et `mostAdvanced` trie par
progression brute décroissante : un objectif complété a `progress >= 1`, il
bat donc tout objectif en cours.

**Mesuré** — trois objectifs, un terminé il y a deux semaines et deux en
cours : `mostAdvanced` désigne le terminé. Un second test montre que
`totalSessions` vaut 0 sur la fenêtre de sept jours — la carte couronne donc
un objectif dont rien n'a bougé pendant la période qu'elle prétend résumer.

`mostBehind` n'est pas touché de la même façon : il exclut déjà
`mostAdvanced` depuis le correctif L1-07. Le finding porte sur la carte du
haut.

La piste de Cowork — filtrer sur les actifs avant le calcul, avec
`splitGoalsByStatus` déjà en place ailleurs — tient. À décider en même temps :
la carte « Tous les objectifs » plus bas mélange elle aussi actifs et
terminés, mais son titre l'annonce, donc c'est défendable.

Rejoint le **chantier F**.

## RC-C — « corriger une entrée peut compléter sans notifier » · **Reclassé : question produit, pas défaut**

Site : `src/goals-context.tsx`.

La lecture de Cowork est exacte : `updateEntry` remplace `entries[idx]` et
n'appelle `getGoalStats` ni avant ni après, là où `addProgress` compare les
deux pour poser `pendingGoalReachedTitle`. Il n'y a effectivement aucune
logique équivalente.

Mais ce n'est pas un oubli. Trois tests de `src/goals-context.test.tsx`
épinglent ce comportement, dont un qui porte le cas dans son nom :

- `describe('updateEntry')` → `it('never sends a notification, even when the edit completes the goal')`
  — corrige l'entrée du 10 août à 100 sur une cible de 100, puis
  `expect(sendGoalReachedNotification).not.toHaveBeenCalled()`
- `describe('deleteEntry')` → `it('never sends a notification')`
- `describe('replaceAllGoals')` → `it('never sends a notification, even when a restored goal is already completed')`

Les trois dessinent une politique cohérente : **seule une progression
ajoutée déclenche la célébration**. Une correction, une suppression et un
import restauré sont des actes administratifs.

Écrire un test rouge exigeant l'inverse reviendrait à trancher une question
produit par un test, ce que cette revue s'est interdit partout ailleurs.
RC-C est donc une question ouverte à poser à Pablo, pas un finding : _une
correction d'historique qui franchit le seuil doit-elle célébrer ?_ Si la
réponse est oui, c'est le test ci-dessus qu'il faut changer en premier — et
son nom montre qu'il a été écrit en connaissance de cause.

## Ce que cet écart dit des deux passes

Les trois findings sont dans des fichiers que j'ai ouverts — `edit.tsx` et
`weekly.tsx` pour R3-01, `goals-context.tsx` pour R2-02. Je les ai lus en
cherchant une classe de défaut précise (la garde `loaded`, l'ordre des
gardes d'écriture) et je n'ai pas relu le reste du fichier avec le même
soin. C'est le coût d'une revue organisée par thème plutôt que par fichier,
et il est symétrique : la passe Cowork a manqué des choses que la mienne a
vues.

À retenir pour la prochaine passe : quand un lot ouvre un fichier, le fichier
est lu en entier, même si le motif cherché est trouvé dans les vingt
premières lignes.

Sur le fond, RC-A et RC-B confirment le motif décrit en 6.1 — poser
l'invariant plutôt que le correctif ponctuel. RC-B en particulier : trois
écrans séparent les objectifs actifs des terminés, le quatrième ne le fait
pas, et rien dans le code ne dit que c'est une règle.
