import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Konvention im Code: unbenutzte Funktionsparameter/Variable mit «_»-Präfix
    // (z.B. `_prev` in Server-Actions-Signaturen für useActionState).
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Von `prisma contract emit` generiert:
    "src/prisma/contract.json",
    "src/prisma/contract.d.ts",
    "src/prisma/ops.json",
    // Von `prisma migration plan` generierte Snapshots (Contract-Kopien):
    "migrations/snapshots/**",
  ]),
]);

export default eslintConfig;
