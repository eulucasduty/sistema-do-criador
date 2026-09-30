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
    // Oficinas do editor de vídeo: cópias do kit e composições geradas, só no PC da estação
    "editor/oficina/**",
    // HyperFrames e GSAP que a estação instala sozinha
    "editor/ferramentas/**",
  ]),
]);

export default eslintConfig;
