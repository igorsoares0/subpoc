import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The worker is a separate Python service; its venv ships huge bundled
    // .d.ts files (Playwright) that ESLint must not lint. Flat config does not
    // read .gitignore, so ignore it explicitly here.
    "worker/**",
  ]),
]);

export default eslintConfig;
