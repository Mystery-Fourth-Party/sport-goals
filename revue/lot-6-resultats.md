# Revue — lot 6 : outillage

Périmètre : CI, `package.json`, configuration jest / eslint / tsconfig /
prettier, `app.json`, `eas.json`, dépendances, conformité SDK 57. Base :
master à `04df1f8`.

Comme au lot 5, chaque constat est une mesure reproductible, pas une lecture.
Les commandes sont données à chaque fois.

## R6-01 — la CI vérifie les types d'un programme plus faible que le poste de développement

`experiments.typedRoutes: true` (app.json) fait générer `.expo/types/router.d.ts`,
qui contraint `router.push()` à l'ensemble des routes réellement présentes
dans `app/`. `tsconfig.json` l'inclut explicitement, avec `expo-env.d.ts`.

Or `.gitignore` ignore `.expo/` **et** `expo-env.d.ts`, et le workflow CI
n'enchaîne que `npm ci`, `typecheck`, `lint`, `format:check`, `jest` — aucune
de ces étapes ne régénère ces deux fichiers.

Mesure — un appel vers une route inexistante ajouté temporairement dans
`src/` :

```ts
router.push('/ecran-qui-n-existe-pas');
```

| Contexte                                 | Résultat                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Poste de développement (types générés)   | `error TS2345: Argument of type '"/ecran-qui-n-existe-pas"' is not assignable…` |
| Après `mv .expo … && mv expo-env.d.ts …` | **code de sortie 0, aucune erreur**                                             |

Un lien cassé vers un écran supprimé ou renommé passe donc la CI. La garantie
annoncée par `typedRoutes` ne tient que sur la machine de celui qui a lancé le
serveur de développement en dernier.

## R6-02 — toute la suite tourne en `Platform.OS === 'ios'`

Le preset `jest-expo` sans suffixe cible iOS. `jest-expo` en fournit quatre :
`ios`, `android`, `web`, `universal`.

Mesure : un test jetable affichant `Platform.OS` imprime `ios`. Corroboré au
lot 4, où `TimeField` rendait `RNDateTimePicker` — le chemin
`datetimepicker.ios.js`.

Le dépôt compte **11 branches `Platform.OS`** en dehors des tests. Sous iOS,
ne sont jamais exécutées : le sélecteur d'heure Android et son repli web
(`TimeField`), l'export et l'import web (`DataSection`), le message
d'indisponibilité web (`NotificationsSection`), le repli web de
`confirmDestructive`, et la création du channel de notifications Android.

C'est la dernière qui compte le plus. `notifications.ts:44` :

```ts
async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
```

Le commentaire juste en dessous dit : « Requis sur Android 8+ (API 26+) :
sans channel, aucune notification ne s'affiche sur ces versions. »

Mutation `N2` (voir `revue/lot-5-mutations.sh`) — l'appel à
`setupAndroidChannel()` est neutralisé : **SURVIVANT**. La mutation `N3`, qui
retire `channelId` du déclencheur quotidien, est tuée : un test épingle donc
l'usage du channel, aucun sa création.

Le projet n'est testé sur appareil que sous Android (builds EAS preview,
TalkBack sur One UI). La suite tourne sur la seule plateforme que personne ne
vérifie à la main.

## R6-03 — l'icône de notification Android n'est pas configurée

`app.json` liste `"expo-notifications"` en chaîne nue, donc sans props. Le
plugin accepte `{ icon, color, defaultChannel }`
(`node_modules/expo-notifications/plugin/build/withNotificationsAndroid.js`).
Sans `icon`, aucune ressource `notification_icon` n'est produite et Android
retombe sur l'icône de l'application.

Android n'utilise que le canal alpha d'une petite icône de notification : une
image entièrement opaque devient un aplat blanc.

Mesure — type de couleur PNG (octet 25 de l'en-tête IHDR) :

| Fichier                              | Type     | Canal alpha |
| ------------------------------------ | -------- | ----------- |
| `assets/icon.png`                    | 2 (RGB)  | **aucun**   |
| `assets/android-icon-monochrome.png` | 6 (RGBA) | oui         |

L'icône servie à la notification n'a donc pas de canal alpha du tout. Le
rappel quotidien — la fonctionnalité qui justifie `expo-notifications`,
`ReminderScheduler`, quatre réglages et 429 lignes de tests — s'affiche avec
un carré blanc dans la barre d'état.

L'asset qui conviendrait existe déjà : `android-icon-monochrome.png`, en RGBA,
posé pour la couche monochrome de l'icône adaptative.

À confirmer sur un build EAS preview : aucune checklist Notion ne couvre
l'apparence de la notification, seulement son déclenchement.

## R6-04 — l'écran de démarrage n'est jamais configuré

`app.json` liste `"expo-splash-screen"` en chaîne nue. Le point d'entrée du
plugin (`node_modules/expo-splash-screen/plugin/build/withSplashScreen.js`) :

```js
const withSplashScreen = (config, props) => {
  if (props != null) {
    config = withAndroidSplashScreen(config, props);
    config = withIosSplashScreen(config, props);
  }
  return config;
};
```

Sans props, **le plugin ne fait rien** : ni image, ni couleur de fond, sur
aucune des deux plateformes. `assets/splash-icon.png` n'est référencé nulle
part dans le dépôt (`grep -rn splash` ne trouve que le code de `_layout.tsx`
et la ligne de `app.json`).

Et `app/_layout.tsx` retient délibérément ce splash :

```ts
SplashScreen.preventAutoHideAsync().catch(() => {});
```

… le temps que Barlow Condensed et Outfit soient chargées, pour éviter un
flash de polices système. Ce qui est maintenu à l'écran pendant ce temps est
donc l'écran par défaut de la plateforme, sur une application entièrement
sombre (`userInterfaceStyle: "dark"`, `colors.appBg`). Le soin pris à éviter
un flash de polices tient un écran qui n'a jamais été habillé.

Le rendu exact demande un build pour être décrit ; le mécanisme, lui, est lu
dans la source du plugin.

## R6-05 — la notification « objectif atteint » n'utilise pas le channel créé par l'app

`notifications.ts:281`, `sendGoalReachedNotification` programme son contenu
avec `trigger: null` et sans `channelId`, alors que le rappel quotidien pose
`channelId: CHANNEL_ID` (`'reminders'`, importance `HIGH`, nommé « Rappels et
objectifs »).

Les deux notifications de l'application n'atterrissent donc pas dans le même
channel Android, et les réglages système que l'utilisateur applique à
« Rappels et objectifs » ne concernent pas la célébration. Gravité basse, mais
c'est une incohérence à trancher plutôt qu'à laisser au hasard du canal par
défaut.

## R6-06 — rien ne surveille la dérive vis-à-vis du SDK

`AGENTS.md` s'ouvre sur « Expo HAS CHANGED — read the exact versioned docs ».
Aucune étape de CI ne vérifie pourtant l'alignement des dépendances.

Mesure — `npx expo install --check` et `npx expo-doctor@latest` :

- **20 des 21 vérifications d'expo-doctor passent.** La seule en échec est
  l'alignement des versions.
- **12 paquets en retard** sur ce qu'attend le SDK installé, dont
  `expo-notifications` (57.0.15 pour 57.0.20 attendu), `expo-router`
  (57.0.17 / 57.0.22) et `expo` lui-même (57.0.18 / 57.0.24).

Les plages de `package.json` sont en `~57.0.x` et autoriseraient ces
correctifs ; c'est `package-lock.json`, figé, que `npm ci` réinstalle à
l'identique. La dérive est donc silencieuse et ne fera que croître.

## R6-07 — la version de Node de la CI est une cible mobile

`.github/workflows/ci.yml` : `node-version: lts/*`. Pas de `.nvmrc`, pas de
champ `engines` dans `package.json`.

Ce n'est pas anodin ici : la stratégie de test des fuseaux repose sur un
comportement propre à la version de Node — poser `process.env.TZ` **à
l'intérieur** de jest ne déplace plus l'horloge (constaté sur Node 20), ce qui
est précisément la raison d'être des trois passages `TZ=` du workflow. Le jour
où `lts/*` bascule sur une majeure suivante, ce socle change sans que rien ne
l'annonce.

## Constats, sans finding séparé

- **`collectCoverageFrom` porte sur 4 fichiers** (`stats`, `backup`,
  `dateLabels`, `goalValidation`) sur une quarantaine de modules. `npm test`
  n'affiche donc rien sur les contextes, les écrans ou `notifications.ts`.
  C'est le pendant outillage de **R5-01** et **R5-03** : la couverture ne
  ment pas, elle ne regarde simplement pas là.
- **`npm run lint` ne pose pas `--max-warnings 0`.** Un avertissement
  (`import/no-named-as-default-member` sur `src/i18n/index.ts`) survit depuis
  le début de la campagne sans jamais faire échouer la CI.
- **`ios.bundleIdentifier` absent** de `app.json` alors qu'`android.package`
  est renseigné. Sans conséquence tant qu'aucun build iOS n'est lancé, mais
  l'asymétrie mérite d'être décidée plutôt que subie.
- **`@react-native-community/datetimepicker` émet un avertissement de
  dépréciation** à chaque rendu : `onChange is deprecated. Use onValueChange,
onDismiss, and onNeutralButtonPress instead`. Reporté du lot 4.

## Vérifié, rien à signaler

- `react-native-reanimated`, `react-native-worklets`, `expo-constants`,
  `expo-linking` et `react-dom` ne sont importés par aucun fichier de `src/`
  ou `app/` — mais `npm ls` les montre tous requis par `expo-router` ou
  `expo`. Ce sont des dépendances directes légitimes, pas du poids mort.
- `.gitattributes` (`* text=auto eol=lf`), `.prettierrc`, `.prettierignore` :
  cohérents, et suffisants pour un poste Windows.
- La configuration eslint typée pour `no-floating-promises` fait bien porter
  l'analyse sur le projet, avec `typescript-eslint` en dépendance directe —
  le commentaire qui l'explique est exact.
- La matrice de fuseaux du workflow fonctionne réellement (mesuré au lot 5) :
  seule la passe `TZ=UTC` est aveugle, ce qui est le sujet de **R5-02**.
- `eas.json` : trois profils cohérents, `appVersionSource: local` avec
  `autoIncrement` en production.
