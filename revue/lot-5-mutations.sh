#!/usr/bin/env bash
#
# REVUE — LOT 5 (suite de tests). Outil de mesure, pas un test.
#
# Les lots 1 à 4 prouvaient un défaut par un test rouge. Ce lot-ci porte sur
# la suite elle-même : la question n'est plus « ce code est-il juste ? »
# mais « si ce code cessait de l'être, un test le verrait-il ? ». Un test
# rouge ne peut pas répondre à ça — on ne peut pas écrire un test qui échoue
# parce qu'un *autre* test est faible.
#
# La mesure se fait donc à l'envers : on casse délibérément une règle de
# production, on relance toute la suite, et on regarde si quelque chose
# tombe. Un mutant « SURVIVANT » désigne un comportement que rien ne tient.
#
# Chaque mutation est appliquée puis annulée par `git checkout --`. Le script
# exige un arbre propre et le laisse propre. Les fichiers de preuve des lots
# 1 à 4 sont exclus des exécutions : ils sont rouges par construction.
#
# Usage : bash revue/lot-5-mutations.sh [motif]
#   motif : ne joue que les mutations dont l'identifiant correspond (ex. M5).
set -u

cd "$(dirname "$0")/.." || exit 1

if ! git diff --quiet; then
  echo "Arbre de travail non propre — ce script annule ses mutations par git checkout."
  exit 1
fi

FILTRE="${1:-}"
survivants=0
total=0

mut() {
  local id="$1" file="$2" from="$3" to="$4"
  [ -n "$FILTRE" ] && [[ "$id" != *"$FILTRE"* ]] && return 0
  total=$((total + 1))

  FROM="$from" TO="$to" perl -0pi \
    -e 'BEGIN{$f=quotemeta($ENV{FROM}); $t=$ENV{TO}} s/$f/$t/' "$file"

  if git diff --quiet -- "$file"; then
    echo "!! $id : mutation non appliquée (le code source a changé ?)"
    return 1
  fi

  if npx jest --testPathIgnorePatterns "revue-lot" --silent >/dev/null 2>&1; then
    echo "SURVIVANT  $id"
    survivants=$((survivants + 1))
  else
    echo "tué        $id"
  fi
  git checkout -- "$file"
}

# ─── src/stats.ts — seuil de couverture à 95 % de branches, 100 % atteint ──
mut "M1  seuil « en avance » 0,05 -> 0,04" src/stats.ts \
  "if (diff > 0.05)" "if (diff > 0.04)"
mut "M2  seuil « en retard » -0,1 -> -0,11" src/stats.ts \
  "else if (diff > -0.1)" "else if (diff > -0.11)"
mut "M3  diviseur planché de dailyRequired 1 -> 2" src/stats.ts \
  "Math.max(1, remainingDays)" "Math.max(2, remainingDays)"
mut "M4  arrondi anti-epsilon du statut supprimé" src/stats.ts \
  "Math.round((progress - expectedProgress) * 1e6) / 1e6" "progress - expectedProgress"
mut "M5  plancher 0 sur elapsedDays supprimé" src/stats.ts \
  "Math.max(0, Math.min(diffDays(start, todayDate), totalDays))" \
  "Math.min(diffDays(start, todayDate), totalDays)"
mut "M6  dailyAvg sur durée nulle -> 0" src/stats.ts \
  "totalDays > 0 ? goal.targetValue / totalDays : goal.targetValue" \
  "totalDays > 0 ? goal.targetValue / totalDays : 0"
mut "M7  expectedProgress sur durée nulle : >= 0 -> > 0" src/stats.ts \
  "diffDays(start, todayDate) >= 0 ? 1 : 0" "diffDays(start, todayDate) > 0 ? 1 : 0"
mut "M8  fmt km : une décimale -> deux" src/stats.ts \
  "if (unit === 'km') return value.toFixed(1);" "if (unit === 'km') return value.toFixed(2);"
mut "M9  calcStreak ne rompt plus sur une entrée à 0" src/stats.ts \
  "if (val === undefined || val === 0) break;" "if (val === undefined) break;"
mut "M10 plancher 0 sur dailyRequired supprimé" src/stats.ts \
  "Math.max(0, (goal.targetValue - actual) / Math.max(1, remainingDays))" \
  "(goal.targetValue - actual) / Math.max(1, remainingDays)"
mut "M11 plancher 0 sur remainingDays supprimé" src/stats.ts \
  "const remainingDays = Math.max(0, diffDays(todayDate, end));" \
  "const remainingDays = diffDays(todayDate, end);"

# ─── src/backup.ts, goalValidation.ts, dateLabels.ts — mêmes seuils ────────
mut "B1  recordedAt non conforme accepté" src/backup.ts \
  "if (e.recordedAt !== undefined && typeof e.recordedAt !== 'string') return false;" \
  "if (false) return false;"
mut "B2  reminderEnabled non booléen accepté" src/backup.ts \
  "if (g.reminderEnabled !== undefined && typeof g.reminderEnabled !== 'boolean') return false;" \
  "if (false) return false;"
mut "B3  tri des entrées importées inversé" src/backup.ts \
  ".sort((a, b) => (a.date < b.date ? -1 : 1))" ".sort((a, b) => (a.date < b.date ? 1 : -1))"
mut "B4  valeur d'entrée négative acceptée" src/backup.ts \
  "if (!Number.isFinite(e.value) || e.value < 0) {" "if (!Number.isFinite(e.value)) {"
mut "B5  échéance égale à la création acceptée" src/backup.ts \
  "if (deadline <= createdAt) return" "if (deadline < createdAt) return"
mut "B6  langue inconnue acceptée à l'import" src/backup.ts \
  "if (raw.language === 'fr' || raw.language === 'en') settings.language = raw.language;" \
  "if (raw.language !== undefined) settings.language = raw.language;"
mut "V1  durée fractionnaire acceptée" src/goalValidation.ts \
  "if (!Number.isInteger(days) || days <= 0) return null;" "if (days <= 0) return null;"
mut "D1  repli « date invalide » supprimé sur weekdayShort" src/dateLabels.ts \
  "export function weekdayShort(d: Date): string {
  if (!isValidDate(d)) return invalidDateLabel();" \
  "export function weekdayShort(d: Date): string {"

# ─── Contextes et stockage — aucun seuil de couverture ────────────────────
mut "C1  ordre des deux gardes de l'effet de sauvegarde inversé" src/goals-context.tsx \
  "    if (readFailed) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }" \
  "    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (readFailed) return;"
mut "C2  garde readFailed supprimée (L2-02)" src/goals-context.tsx \
  "    if (readFailed) return;
" ""
mut "C3  garde !loaded supprimée" src/goals-context.tsx \
  "    if (!loaded) return;" "    if (false) return;"
mut "C4  updateEntry accepte une valeur <= 0" src/goals-context.tsx \
  "if (newValue <= 0) return;" "if (newValue < -1e9) return;"
mut "P1  settings-context : garde readFailed supprimée" src/settings-context.tsx \
  "if (readFailed) return;" "if (false) return;"
mut "P2  une lecture en échec est rapportée comme réussie" src/storage.ts \
  "    return { value: [], ok: false };" "    return { value: [], ok: true };"
mut "P3  liste absente traitée comme un échec de lecture" src/storage.ts \
  "if (!raw) return { value: [], ok: true };" "if (!raw) return { value: [], ok: false };"
mut "R1  ReminderScheduler : langue retirée des dépendances" src/ReminderScheduler.tsx \
  "i18n.language," ""

# ─── Écrans ───────────────────────────────────────────────────────────────
mut "E1  Détail : !loaded retiré de la garde de rendu" "app/goal/[id].tsx" \
  "if (!loaded || !goal) {" "if (!goal) {"
mut "E1b Détail : « Objectif introuvable » affiché pendant le chargement" "app/goal/[id].tsx" \
  "{loaded && <Text style={styles.notFound}>{t('goalDetail.notFound')}</Text>}" \
  "<Text style={styles.notFound}>{t('goalDetail.notFound')}</Text>"
mut "E2  Édition : !loaded retiré de la garde de rendu (L3-01)" "app/goal/[id]/edit.tsx" \
  "if (!loaded || !goal) {" "if (!goal) {"
mut "E2b Édition : « Objectif introuvable » affiché pendant le chargement" "app/goal/[id]/edit.tsx" \
  "{loaded && <Text style={styles.notFound}>{t('goalDetail.notFound')}</Text>}" \
  "<Text style={styles.notFound}>{t('goalDetail.notFound')}</Text>"
mut "E3  Hebdo : couleur du plus avancé forcée au vert (L3-03)" app/weekly.tsx \
  "{ color: statusColors[mostAdvanced.stats.status].text }," "{ color: statusColors.ahead.text },"
mut "S1  LanguageSection : libellé d'accessibilité supprimé (L4-04)" \
  src/components/settings/LanguageSection.tsx \
  "accessibilityLabel={t(option.labelKey)}" "accessibilityLabel={undefined}"
mut "S2  DataSection : libellé d'accessibilité de l'export supprimé (L4-04)" \
  src/components/settings/DataSection.tsx \
  "accessibilityLabel={rowA11yLabel('export')}" "accessibilityLabel={undefined}"
mut "N1  rappel : streak calculé au jour même au lieu de la veille" src/notifications.ts \
  "const streak = calcStreak(g.entries, yesterday);" "const streak = calcStreak(g.entries, today);"
mut "I1  Accueil : la liste affiche les objectifs terminés" app/index.tsx \
  "        data={active}" "        data={completed}"
mut "I2  Accueil : libellé d'accessibilité du titre supprimé" app/index.tsx \
  "accessibilityLabel={t('goalList.headingA11y')}" "accessibilityLabel={undefined}"

echo
echo "$survivants survivant(s) sur $total mutation(s)."
