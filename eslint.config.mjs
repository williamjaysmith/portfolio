// Flat config. eslint-config-next v16 ships native flat configs, so the old
// FlatCompat wrapper around "next/core-web-vitals" is no longer needed — and in
// fact crashes ESLint 9 with "Converting circular structure to JSON".
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "graphify-out/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  {
    // The browser suite is not React. Playwright's fixture API hands each
    // fixture a `use` callback, which the React plugin reads as the `use`
    // hook and rejects. Scoping the rule away from a folder that renders no
    // React is configuration, not a suppression: no rule is weakened where
    // React actually runs, and no finding is silenced (007 FR-729).
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default eslintConfig;
