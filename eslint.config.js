import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-plugin-prettier/recommended";

export default [
  { ignores: ["src/Components/Backgammon"] },
  js.configs.recommended,
  react.configs.flat.recommended,
  reactHooks.configs["recommended-latest"],
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
      // react-three-fiber's props (position, args…)
      "react/no-unknown-property": "off",
      "no-unused-vars": "warn",
      "no-constant-condition": "off",
    },
  },
  // run by node: the configs and the e2e tests
  {
    files: ["*.config.js", "e2e/okey.e2e.js"],
    languageOptions: { globals: globals.node },
  },
];
