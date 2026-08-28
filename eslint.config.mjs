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
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
