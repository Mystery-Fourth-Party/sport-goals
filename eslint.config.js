// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const tseslint = require('typescript-eslint');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*'],
  },
  // Analyse typée, limitée aux sources TypeScript du projet. Nécessaire pour
  // no-floating-promises, qui a besoin de savoir qu'une expression est une
  // Promise — une règle purement syntaxique ne peut pas le déterminer.
  // typescript-eslint est une dépendance directe plutôt que le transitif
  // fourni par eslint-config-expo : la règle activée ici ne doit pas dépendre
  // d'un arbre de dépendances qu'on ne contrôle pas.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Une promesse non attendue échoue en silence : le rejet ne remonte
      // nulle part et l'ordre d'exécution n'est plus garanti. Adopté le
      // 01/09 après le tri de revue de code, qui avait trouvé plusieurs
      // sites de ce type. `await` quand la suite en dépend, `.catch()`
      // explicite quand l'échec est acceptable — jamais ignoré tacitement.
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
]);
