import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Goal, Unit } from '../types';
import GoalFields from './GoalFields';

interface Props {
  onCreate: (goal: Goal) => void;
}

export default function GoalForm({ onCreate }: Props) {
  // Formulaire contrôlé classique (comme en React web) : un useState par champ.
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState<Unit>('reps');
  const [durationDays, setDurationDays] = useState('');
  // Les erreurs ne s'affichent qu'après une première tentative de soumission
  // invalide, pour ne pas asperger l'utilisateur de messages rouges dès
  // qu'il commence à remplir le formulaire.
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const titleError = title.trim() === '' ? "Le titre de l'objectif est requis." : undefined;
  const targetValueError =
    Number(targetValue) > 0 ? undefined : 'La valeur cible doit être un nombre positif.';
  const durationError =
    Number(durationDays) > 0 ? undefined : 'La durée doit être un nombre de jours positif.';
  const canSubmit = !titleError && !targetValueError && !durationError;

  function handleSubmit() {
    if (!canSubmit) {
      setSubmitAttempted(true);
      return;
    }

    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + Number(durationDays));

    onCreate({
      // Le global crypto.randomUUID() n'est pas garanti sur Hermes (natif) ;
      // expo-crypto fournit une implémentation fiable sur toutes les plateformes.
      id: Crypto.randomUUID(),
      title: title.trim(),
      targetValue: Number(targetValue),
      currentValue: 0,
      unit,
      createdAt: now.toISOString(),
      deadline: deadline.toISOString(),
    });

    setTitle('');
    setTargetValue('');
    setDurationDays('');
    setUnit('reps');
    setSubmitAttempted(false);
  }

  return (
    <View style={styles.container}>
      <GoalFields
        title={title}
        onTitleChange={setTitle}
        targetValue={targetValue}
        onTargetValueChange={setTargetValue}
        unit={unit}
        onUnitChange={setUnit}
        durationLabel="Durée (jours)"
        duration={durationDays}
        onDurationChange={setDurationDays}
        titleError={submitAttempted ? titleError : undefined}
        targetValueError={submitAttempted ? targetValueError : undefined}
        durationError={submitAttempted ? durationError : undefined}
      />

      {/* Pressable = équivalent RN de <button onClick>. Reste toujours
          actif : une tentative de soumission invalide affiche les erreurs
          inline plutôt que de simplement ignorer le press. */}
      <Pressable style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Créer l’objectif</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
