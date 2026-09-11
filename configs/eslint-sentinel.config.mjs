import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import eslintPluginImport from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import tsParser from "@typescript-eslint/parser";
import jest from "eslint-plugin-jest";

// Config de fallback: solo se usa cuando el proyecto no trae su propia configuración de ESLint.
// Alineada a @architecture-it/eslint-config-andreani (variante react-ts) para minimizar
// diferencias respecto al linter que corren los proyectos localmente.

const ignoredFolders = globalIgnores([
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/storybook-static/**",
  "next-env.d.ts",
]);

const basicRules = {
  "import/order": [
    "warn",
    {
      "newlines-between": "always",
    },
  ],
  quotes: "off",
  semi: ["error", "always"],
  "no-restricted-syntax": [
    "warn",
    {
      selector:
        "CallExpression[callee.object.name='console'][callee.property.name=/^(log|warn|error|info|trace)$/]",
      message: "Prefer using the standard logger from '@architecture-it/core/logger'",
    },
  ],
  "prettier/prettier": [
    "error",
    {
      singleQuote: false,
      trailingComma: "es5",
      semi: true,
      tabWidth: 2,
      printWidth: 100,
      bracketSpacing: true,
      arrowParens: "always",
      endOfLine: "auto",
    },
  ],
  "no-unused-vars": [
    "warn",
    {
      args: "after-used",
      ignoreRestSiblings: true,
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
  "padding-line-between-statements": [
    "error",
    {
      blankLine: "always",
      prev: "*",
      next: "return",
    },
    {
      blankLine: "always",
      prev: ["const", "let", "var"],
      next: "*",
    },
    {
      blankLine: "any",
      prev: ["const", "let", "var"],
      next: ["const", "let", "var"],
    },
  ],
  "no-debugger": "warn",
};

const tsRules = {
  "no-unused-vars": "off",
  "@typescript-eslint/no-empty-object-type": [
    "error",
    {
      allowInterfaces: "always",
    },
  ],
  "@typescript-eslint/no-explicit-any": [
    "warn",
    {
      fixToUnknown: true,
      ignoreRestArgs: true,
    },
  ],
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      args: "all",
      argsIgnorePattern: "^_",
      caughtErrors: "all",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ],
  "no-unused-expressions": "off",
  "@typescript-eslint/no-unused-expressions": [
    "warn",
    {
      allowShortCircuit: true,
    },
  ],
  "@typescript-eslint/no-require-imports": "warn",
};

const reactRules = {
  "react/self-closing-comp": "warn",
  "react-hooks/rules-of-hooks": "warn",
  "react/jsx-sort-props": [
    "warn",
    {
      callbacksLast: true,
      shorthandFirst: true,
      noSortAlphabetically: false,
      reservedFirst: true,
    },
  ],
  "react/display-name": ["off", "always"],
  "react/react-in-jsx-scope": ["off", "always"],
  "react/jsx-no-useless-fragment": "warn",
  "react/prop-types": "off",
};

export default defineConfig([
  ignoredFolders,
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    plugins: {
      prettier,
      import: eslintPluginImport,
    },
    rules: {
      ...basicRules,
    },
  },
  {
    files: ["**/*.ts", "**/*.cts", "**/*.mts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: {
      prettier,
      import: eslintPluginImport,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      ...basicRules,
      ...tsRules,
    },
  },
  {
    files: ["**/*.jsx"],
    extends: [
      reactHooks.configs.flat["recommended-latest"],
      react.configs.flat?.recommended,
      react.configs.flat?.["jsx-runtime"],
    ],
    plugins: {
      react,
      import: eslintPluginImport,
      prettier,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...basicRules,
      ...reactRules,
    },
  },
  {
    files: ["**/*.tsx"],
    extends: [
      tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      react.configs.flat?.recommended,
      react.configs.flat?.["jsx-runtime"],
    ],
    plugins: {
      react,
      import: eslintPluginImport,
      prettier,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...basicRules,
      ...tsRules,
      ...reactRules,
    },
  },
  {
    files: ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx", "*.test.js", "*.spec.js"],
    plugins: {
      jest,
      import: eslintPluginImport,
      prettier,
    },
    languageOptions: {
      globals: jest.environments.globals.globals,
    },
    rules: {
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "warn",
      "jest/no-identical-title": "warn",
      "jest/prefer-to-have-length": "warn",
      "jest/valid-expect": "warn",
    },
  },
]);
