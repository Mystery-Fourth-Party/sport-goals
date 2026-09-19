// REVUE — findings remontés par Cowork. Preuves, pas correctifs.
//
// Trois findings de la passe Cowork n'apparaissent dans aucun de mes 22.
// Cowork les donne comme raisonnés ou exécutés ponctuellement, pas prouvés
// au régime des lots 1 à 4, et demande de les passer au même étalon avant de
// les intégrer à un chantier. C'est ce que fait ce fichier.
//
// Identifiants RC-A / RC-B / RC-C pour la page de comparaison Notion.
//
// Résultat : RC-A et RC-B sont confirmés et prouvés ci-dessous. RC-C décrit
// bien le code mais n'est pas un défaut — voir le bloc en fin de fichier.
//
// Base : master à 04df1f8. Branche revue/preuves-claude, jamais destinée au
// merge.
import { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EditGoalScreen from '../app/goal/[id]/edit';
import { GoalsProvider } from '../src/goals-context';
import i18n from '../src/i18n';
import { SettingsProvider } from '../src/settings-context';
import { dateStr, getGoalStats, getWeeklyStats, parseDate, todayStr } from '../src/stats';
import { loadGoals, saveGoals } from '../src/storage';
import { StorageStatusProvider } from '../src/storage-status';
import { Goal } from '../src/types';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'g1' }),
}));

jest.mock('../src/storage', () => {
  const actual = jest.requireActual('../src/storage');
  return { ...actual, loadGoals: jest.fn(), saveGoals: jest.fn() };
});

const mockedLoadGoals = loadGoals as jest.Mock;
const mockedSaveGoals = saveGoals as jest.Mock;

beforeAll(() => i18n.changeLanguage('fr'));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedLoadGoals.mockReset();
  mockedSaveGoals.mockReset().mockResolvedValue(true);
});

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageStatusProvider>
      <SettingsProvider>
        <GoalsProvider>{children}</GoalsProvider>
      </SettingsProvider>
    </StorageStatusProvider>
  );
}

// ─── RC-A ────────────────────────────────────────────────────────────────
// L'écran Édition réinitialise silencieusement l'échéance d'un objectif en
// retard.
//
// Le champ « Jours restants » s'initialise sur
// `String(Math.max(1, s.remainingDays))` (edit.tsx:74), et handleSave
// recalcule TOUJOURS l'échéance à partir de ce champ :
// `deadline = aujourd'hui + daysNum`.
//
// Pour un objectif encore en cours, les deux se compensent exactement :
// remainingDays vaut diffDays(aujourd'hui, échéance), donc réécrire
// aujourd'hui + remainingDays retombe sur le même jour calendaire.
// Enregistrer sans toucher à la durée ne déplace donc pas l'échéance —
// c'est la norme de cet écran, et le second test de ce describe la constate.
//
// Pour un objectif dépassé, remainingDays vaut 0 et le plancher à 1 casse
// cette compensation : le champ affiche « 1 », et enregistrer une simple
// correction de titre repousse l'échéance à demain. L'objectif cesse d'être
// en retard — statut, bannière, rythme requis et carte « le plus en retard »
// du résumé hebdomadaire suivent.
//
// Le plancher n'est pas gratuit : parseDurationDays refuse 0, donc sans lui
// un objectif dépassé ne pourrait plus être édité du tout sans saisir une
// nouvelle durée. C'est l'arbitrage à reprendre, pas le plancher seul.
describe('RC-A — échéance déplacée en corrigeant un autre champ', () => {
  async function ouvrirEdition(deadline: Date) {
    mockedLoadGoals.mockResolvedValue({
      value: [
        {
          id: 'g1',
          title: 'Courir 100 km',
          targetValue: 100,
          unit: 'km',
          createdAt: daysFromNow(-30).toISOString(),
          deadline: deadline.toISOString(),
          entries: [{ date: dateStr(daysFromNow(-20)), value: 12 }],
        } satisfies Goal,
      ],
      ok: true,
    });

    render(<EditGoalScreen />, { wrapper });
    await waitFor(() => expect(screen.getByText(i18n.t('editGoal.save'))).toBeTruthy());
  }

  // Ne touche QUE le titre, puis enregistre — le geste décrit par le
  // finding : l'utilisateur vient corriger autre chose.
  async function renommerPuisEnregistrer() {
    fireEvent.changeText(screen.getByLabelText(i18n.t('goalFields.name')), 'Courir 100 km (2026)');
    await act(async () => {
      fireEvent.press(screen.getByText(i18n.t('editGoal.save')));
    });
    const ecrit = mockedSaveGoals.mock.calls.at(-1)?.[0] as Goal[];
    return ecrit[0];
  }

  it("ne déplace pas l'échéance d'un objectif en retard quand seul le titre change", async () => {
    const echeanceDepassee = daysFromNow(-3);
    await ouvrirEdition(echeanceDepassee);

    // Précondition : l'objectif est bien en retard et il ne lui reste aucun
    // jour — c'est ce que le plancher du champ masque.
    const avant = getGoalStats(
      {
        id: 'g1',
        title: 'Courir 100 km',
        targetValue: 100,
        unit: 'km',
        createdAt: daysFromNow(-30).toISOString(),
        deadline: echeanceDepassee.toISOString(),
        entries: [{ date: dateStr(daysFromNow(-20)), value: 12 }],
      },
      todayStr(),
    );
    expect(avant.status).toBe('late');
    expect(avant.remainingDays).toBe(0);

    const enregistre = await renommerPuisEnregistrer();

    expect(enregistre.title).toBe('Courir 100 km (2026)');
    // Le titre a changé, l'échéance ne doit pas : aujourd'hui elle est
    // repoussée à demain et l'objectif n'est plus en retard.
    expect(dateStr(new Date(enregistre.deadline))).toBe(dateStr(echeanceDepassee));
  });

  // Contrôle : le même geste sur un objectif encore en cours préserve déjà
  // l'échéance. Le test ci-dessus ne demande donc rien de nouveau — il
  // demande que la règle vaille aussi quand l'échéance est passée.
  it("préserve déjà l'échéance d'un objectif encore en cours", async () => {
    const echeanceFuture = daysFromNow(10);
    await ouvrirEdition(echeanceFuture);

    const enregistre = await renommerPuisEnregistrer();

    expect(dateStr(new Date(enregistre.deadline))).toBe(dateStr(echeanceFuture));
  });
});

// ─── RC-B ────────────────────────────────────────────────────────────────
// Un objectif terminé monopolise la carte « objectif le plus avancé » du
// résumé hebdomadaire.
//
// getWeeklyStats reçoit tous les objectifs — app/weekly.tsx passe `goals`
// sans jamais filtrer — et trie mostAdvanced par progression brute
// décroissante. Un objectif complété a progress >= 1 : il bat donc tout
// objectif en cours, quelle que soit l'activité de la semaine écoulée.
//
// L'écran Accueil et l'Archive séparent déjà actifs et terminés par
// splitGoalsByStatus ; le résumé hebdomadaire est le seul à ne pas le faire.
//
// Conséquence : dès qu'un utilisateur termine un objectif, la carte le
// désigne comme « le plus avancé » toutes les semaines suivantes, y compris
// sur une semaine où il n'a rien fait — le widget cesse d'informer.
//
// mostBehind n'est pas touché de la même façon : il exclut déjà mostAdvanced
// (correctif L1-07), donc il continue de désigner un objectif réel. Le
// finding porte sur la carte du haut.
describe('RC-B — le résumé hebdomadaire couronne un objectif terminé', () => {
  const today = todayStr();

  function objectif(id: string, actual: number, target: number): Goal {
    return {
      id,
      title: `Objectif ${id}`,
      targetValue: target,
      unit: 'reps',
      createdAt: daysFromNow(-20).toISOString(),
      deadline: daysFromNow(20).toISOString(),
      entries: [{ date: dateStr(daysFromNow(-14)), value: actual }],
    };
  }

  it('ne présente pas un objectif déjà terminé comme « le plus avancé »', () => {
    // Terminé il y a deux semaines, plus aucune activité depuis.
    const termine = objectif('termine', 100, 100);
    const enCours1 = objectif('en-cours-1', 60, 100);
    const enCours2 = objectif('en-cours-2', 30, 100);

    // Précondition : les trois statuts sont bien ceux qu'on croit.
    expect(getGoalStats(termine, today).status).toBe('completed');
    expect(getGoalStats(enCours1, today).status).not.toBe('completed');
    expect(getGoalStats(enCours2, today).status).not.toBe('completed');

    const { mostAdvanced } = getWeeklyStats([termine, enCours1, enCours2], today);

    if (!mostAdvanced) throw new Error('mostAdvanced absent : fixture à trois objectifs');
    expect(getGoalStats(mostAdvanced.goal, today).status).not.toBe('completed');
  });

  // La semaine observée est bien celle des sept derniers jours : aucune des
  // trois entrées n'y tombe, donc la carte couronne un objectif dont rien
  // n'a bougé pendant la période qu'elle résume.
  it("ne compte aucune séance sur la semaine, ce qui rend le couronnement d'autant plus faux", () => {
    const { weekDates, totalSessions } = getWeeklyStats(
      [objectif('termine', 100, 100), objectif('en-cours-1', 60, 100)],
      today,
    );

    expect(weekDates).toHaveLength(7);
    expect(parseDate(weekDates[6])).toEqual(parseDate(today));
    expect(totalSessions).toBe(0);
  });
});

// ─── RC-C — vérifié, ce n'est pas un défaut ──────────────────────────────
// « Corriger une entrée d'historique peut compléter un objectif sans
// notifier. »
//
// La lecture du code faite par Cowork est exacte : updateEntry remplace
// entries[idx] et n'appelle getGoalStats ni avant ni après, là où
// addProgress compare explicitement les deux pour poser
// pendingGoalReachedTitle. Il n'y a pas de logique équivalente.
//
// Mais ce n'est pas un oubli : c'est une décision, et elle est déjà épinglée
// par trois tests de src/goals-context.test.tsx, dont l'un porte exactement
// ce cas dans son nom —
//
//   describe('updateEntry')
//     it('never sends a notification, even when the edit completes the goal')
//        → corrige l'entrée du 10 août à 100 sur une cible de 100,
//          puis expect(sendGoalReachedNotification).not.toHaveBeenCalled()
//
//   describe('deleteEntry')
//     it('never sends a notification')
//
//   describe('replaceAllGoals')
//     it('never sends a notification, even when a restored goal is already
//         completed')
//
// Les trois dessinent une politique cohérente : seule une progression
// *ajoutée* déclenche la célébration. Une correction, une suppression et un
// import restauré sont des actes administratifs, pas des moments de réussite.
//
// Écrire ici un test rouge exigeant l'inverse reviendrait à trancher une
// question produit par un test, ce que la revue s'est interdit de faire
// partout ailleurs. RC-C est donc reclassé : question produit ouverte, pas
// finding. Si l'arbitrage change, c'est le test ci-dessus qu'il faut
// modifier en premier — et son nom dit qu'il a été écrit en connaissance de
// cause.
//
// C'est le deuxième cas de la campagne où une revendication doit être
// confrontée au test qui la porte (voir la recommandation 6.2 de
// revue/SYNTHESE.md) — cette fois dans l'autre sens : le test tient bien ce
// que son nom annonce.
