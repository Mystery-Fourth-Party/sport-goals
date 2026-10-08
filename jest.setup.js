jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-crypto n'a pas de module natif sous Jest : randomUUID renvoyait undefined,
// donc un id ou un seriesId attribué en test valait undefined. Compteur
// déterministe plutôt qu'un vrai UUID : les tests peuvent comparer des
// identifiants distincts sans dépendre du hasard.
jest.mock('expo-crypto', () => {
  let next = 0;
  return { randomUUID: () => `test-uuid-${++next}` };
});
