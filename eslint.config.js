// Flat config ESLint v9 — requis depuis ESLint 9 (remplace .eslintrc).
// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    rules: {
      // App en français : les apostrophes typographiques dans le JSX ne sont pas
      // des bugs (le texte s'affiche correctement). On évite le bruit `&apos;`.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Dossiers générés / hors-app : non lintés.
    ignores: [
      'dist/**',
      '.expo/**',
      'node_modules/**',
      'ios/**',
      'android/**',
      // Edge Functions Deno : runtime et imports distincts, lint à part.
      'supabase/functions/**',
    ],
  },
];
