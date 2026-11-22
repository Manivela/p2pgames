import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-plugin-prettier/recommended";

export default [
  js.configs.recommended,
  react.configs.flat.recommended,
  // the hooks' own two rules: the plugin's recommended set adds the React
  // Compiler's, which this code isn't written for (TODO.md)
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  prettier,
  {
    files: ["**/*.{js,jsx}"],
    // __BUILD__: the build's time (vite.config.js)
    languageOptions: { globals: { ...globals.browser, __BUILD__: "readonly" } },
    settings: { react: { version: "detect" } },
    rules: {
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": "warn",
      "no-constant-condition": "off",
    },
  },
  // run by node: the configs and the e2e tests
  {
    files: ["*.config.js", "e2e/*.e2e.js"],
    languageOptions: { globals: globals.node },
  },
];
