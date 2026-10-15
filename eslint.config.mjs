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
    "carrosseis/oficina/**",
    // HyperFrames e GSAP que a estação instala sozinha
    "editor/ferramentas/**",
    // O estúdio de motion (Remotion) é um projeto à parte, com cache gerado; os exemplos são só referência pra IA
    "editor/motion/**",
    "editor/kit/motion-exemplos/**",
  ]),
]);

export default eslintConfig;
