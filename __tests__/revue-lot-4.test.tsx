// REVUE — LOT 4 (composants). Preuves, pas correctifs.
//
// Même statut que les lots précédents : chaque test échoue sur master
// (04df1f8). Branche revue/preuves-claude, jamais destinée au merge.
//
// Le lot Composants n'avait été traité qu'au niveau `medium` par la revue du
// 31/08, qui le déclare elle-même.
import { ReactTestInstance } from 'react-test-renderer';
import { act, render, screen } from '@testing-library/react-native';
import GoalCard from '../src/components/GoalCard';
import GoalFields from '../src/components/GoalFields';
import ProgressEntryModal from '../src/components/goal-detail/ProgressEntryModal';
import RecentSessionsCard from '../src/components/goal-detail/RecentSessionsCard';
import { weekdayShort } from '../src/dateLabels';
import i18n from '../src/i18n';
import { getGoalStats, parseDate, todayStr } from '../src/stats';
import { Goal } from '../src/types';

beforeAll(() => i18n.changeLanguage('fr'));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// Toggle anime sur 200 ms au montage (voir src/components/ui/Toggle.tsx) :
// sans ce vidage, RNTL signale une mise à jour hors act().
async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

// ─── R4-01 ───────────────────────────────────────────────────────────────
// Le pourcentage est arrondi à l'entier et atteint 100 % avant que
// l'objectif ne soit complété.
//
// GoalCard et GoalProgressCard rendent tous deux
// `(s.progress * 100).toFixed(0)`. Toute progression au-dessus de 99,5 %
// affiche donc « 100 % » alors que status vaut encore 'ahead' ou
// 'inProgress' — la carte affirme l'objectif atteint et le badge dit le
// contraire, dans la même vue.
//
// Le chemin du pourcentage est indépendant de fmt (R1-02) : c'est une
// expression propre à ces deux composants, que le correctif de fmt ne
// toucherait pas. La racine commune est la même — arrondir une valeur vers
// un entier qui affirme autre chose qu'elle — mais les deux sites doivent
// être corrigés séparément.
//
// ProgressBar porte le même nombre dans son accessibilityValue.text, donc
// un lecteur d'écran annonce « 100 % » lui aussi.
describe('R4-01 — 100 % affiché sur un objectif non complété', () => {
  const presqueComplete: Goal = {
    id: 'presque',
    title: 'Presque fini',
    targetValue: 100,
    unit: 'reps',
    createdAt: daysFromNow(-10),
    deadline: daysFromNow(20),
    entries: [{ date: todayStr(), value: 99.7 }],
  };

  it("n'affiche pas 100 % tant que l'objectif n'est pas complété", () => {
    // Précondition portée sur le statut calculé : l'objectif n'est PAS
    // complété, il reste 0,3 répétition à faire.
    const s = getGoalStats(presqueComplete, todayStr());
    expect(s.status).not.toBe('completed');
    expect(s.progress).toBeLessThan(1);

    render(<GoalCard goal={presqueComplete} onPress={jest.fn()} />);

    expect(screen.queryByText('100%')).toBeNull();
  });
});

// ─── R4-02 ───────────────────────────────────────────────────────────────
// TimeField est le seul contrôle interactif du dépôt sans libellé
// d'accessibilité propre.
//
// Tous les autres ont reçu un libellé explicite après les tests terrain des
// 02/09 et 05/09 : lignes de GoalCard, de NotificationsSection, de
// DataSection, de LanguageSection, chips d'unité et toggles de GoalFields,
// lignes d'historique, graphique hebdomadaire (L4-03/L4-04). TimeField, non
// — et ses deux appelants laissent à côté de lui un Text visible qui est,
// dans les deux cas, le seul indice de ce que le contrôle règle.
//
// Ce Text est un élément séparé pour le lecteur d'écran. Sur Android le
// contrôle est un Pressable role=button dont le seul enfant est l'heure :
// il s'annonce « 20:00, bouton ». Sur le repli web c'est un TextInput sans
// libellé. C'est exactement le motif « un arrêt de navigation par unité de
// sens » que GoalFields applique aux trois lignes juste au-dessus, en
// masquant leur Text — la ligne « Heure du rappel » est la seule exception.
describe('R4-02 — sélecteur d heure sans libellé d accessibilité', () => {
  it('expose un contrôle nommé pour l heure de rappel par objectif', async () => {
    render(
      <GoalFields
        title="Pompes"
        onTitleChange={jest.fn()}
        targetValue="100"
        onTargetValueChange={jest.fn()}
        unit="reps"
        onUnitChange={jest.fn()}
        durationLabel={i18n.t('goalForm.durationLabel')}
        duration="30"
        onDurationChange={jest.fn()}
        reminderEnabled
        onReminderEnabledChange={jest.fn()}
        reminderTime="20:00"
        onReminderTimeChange={jest.fn()}
      />,
    );
    await flush();

    // Le Text voisin ne compte pas : getByLabelText ne regarde que
    // accessibilityLabel/aria-label, c'est-à-dire ce qu'un lecteur d'écran
    // annonce en s'arrêtant sur le contrôle lui-même.
    expect(screen.getByLabelText(i18n.t('goalFields.reminderTime'))).toBeTruthy();
  });
});

// ─── R4-03 ───────────────────────────────────────────────────────────────
// « Dernières séances » étiquette ses barres par jour de la semaine, alors
// que la série n'est pas une semaine.
//
// RecentSessionsCard prend `entries.filter(e => e.value > 0).slice(-7)` :
// les 7 dernières *séances*, qui peuvent s'étaler sur des mois. BarChart
// reçoit `label: weekdayShort(d)` — le graphique de l'écran Résumé
// hebdomadaire, lui, couvre bien 7 jours consécutifs, où ce libellé est
// sans ambiguïté.
//
// Un utilisateur qui s'entraîne le lundi voit donc « lun, lun, lun » sans
// rien pour distinguer les colonnes ni deviner qu'elles sont espacées d'une
// semaine. La carte est par ailleurs masquée au lecteur d'écran (arbitrage
// du test du 02/09) : le libellé visible est le seul canal.
describe('R4-03 — libellés de jour ambigus sur « Dernières séances »', () => {
  it('distingue deux séances tombant le même jour de la semaine', () => {
    render(
      <RecentSessionsCard
        entries={[
          { date: '2026-08-31', value: 10 },
          { date: '2026-09-07', value: 20 },
          { date: '2026-09-14', value: 30 },
        ]}
        unit="reps"
        today={todayStr()}
      />,
    );

    // Trois lundis consécutifs : aujourd'hui les trois colonnes portent le
    // même libellé « lun », rigoureusement indistinguables.
    //
    // includeHiddenElements : toute la carte est masquée au lecteur d'écran
    // (voir ci-dessus), et les requêtes RNTL ignorent par défaut ce qui
    // l'est. C'est bien du rendu visuel qu'on parle ici.
    const lundis = screen.queryAllByText(weekdayShort(parseDate('2026-09-14')), {
      includeHiddenElements: true,
    });
    expect(lundis).toHaveLength(1);
  });
});

// ─── R4-04 ───────────────────────────────────────────────────────────────
// La feuille du modal de progression est un Pressable accessible, donc un
// seul élément d'accessibilité englobant tout son contenu.
//
// Pressable pose `accessible: accessible !== false`
// (node_modules/react-native/Libraries/Components/Pressable/Pressable.js:252)
// : sans prop explicite, il vaut true. Or la feuille est un Pressable —
// uniquement pour que le tap dessus ne referme pas le modal — et elle
// contient le champ, les deux boutons et le lien de suppression.
//
// Le commentaire du backdrop, deux lignes au-dessus, tient précisément ce
// raisonnement et pose accessible={false} pour ne pas exposer une cible
// géante au lecteur d'écran. La même précaution n'a pas été appliquée à la
// feuille, qui est pourtant le conteneur de tout le contenu utile.
//
// Statut de cette preuve : elle épingle l'attribut, pas ce qu'un lecteur
// d'écran fait de ce regroupement — RNTL ne le modélise pas (même portée
// que DataSection.test.tsx et weekly-screen.test.tsx). Le regroupement d'un
// parent accessible est documenté par RN ; il est franc sous VoiceOver et
// plus nuancé sous TalkBack, qui traverse un conteneur sans
// contentDescription. Cohérent avec le test terrain du 02/09, mené sur
// Android, où le champ était bien atteint individuellement. Aucun test iOS
// n'a jamais eu lieu sur ce projet : c'est là que ça se confirme ou
// s'infirme.
describe('R4-04 — feuille du modal exposée comme un seul élément', () => {
  function ancetreAccessible(element: ReactTestInstance | null): ReactTestInstance | null {
    for (let node = element?.parent ?? null; node; node = node.parent) {
      if (node.props?.accessible === true) return node;
    }
    return null;
  }

  it('laisse les boutons du modal focusables un par un', () => {
    render(
      <ProgressEntryModal
        mode="add"
        date={todayStr()}
        value="10"
        error={false}
        unit="reps"
        todayEntry={undefined}
        onChangeValue={jest.fn()}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDeleteEntry={jest.fn()}
      />,
    );

    const enregistrer = screen.getByText(i18n.t('progressModal.save'));

    // Le bouton lui-même est un Pressable accessible : c'est voulu. Ce qui
    // ne l'est pas, c'est qu'un second élément accessible l'englobe.
    const propreBouton = ancetreAccessible(enregistrer);
    expect(ancetreAccessible(propreBouton)).toBeNull();
  });
});
