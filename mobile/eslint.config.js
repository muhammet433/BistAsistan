const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: ['node_modules/*', '.expo/*', 'dist/*', 'App.tsx'],
  },
  expoConfig,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/array-type': 'off',
    },
  },
]);
