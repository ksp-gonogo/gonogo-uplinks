import { defineConfig } from "vitest/config";

// No `@ksp-gonogo/*` aliases. This client imports only published packages, so
// everything resolves from its own node_modules the way it would for an author
// outside this repo, dist and all.

export default defineConfig({
  test: {
    // 30s, not the 5s default: the first test in a file pays that file's cold
    // start, and under a parallel `turbo test` every package pays it at once.
    testTimeout: 30_000,
    pool: "threads",
    name: "rp1",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // `**/node_modules/**`, not `node_modules/**`. Overriding `exclude` replaces
    // vitest's default list, and the sdk tarball ships its own `src` with test
    // files in it, so the unanchored glob collects them all and the run dies
    // before reaching this Uplink's own tests.
    exclude: ["dist/**", "**/node_modules/**"],
    // ui-kit and the sdk are processed by Vite rather than pre-bundled by
    // esbuild. Installed normally, as any author outside the gonogo monorepo
    // installs them, ui-kit's dist goes through the optimizer and its
    // `styled-components` default import comes back as a namespace: every test
    // file then dies in setup with "styled.span is not a function".
    server: {
      deps: {
        inline: [
          "@ksp-gonogo/ui-kit",
          "@ksp-gonogo/sitrep-sdk",
          "@ksp-gonogo/uplink-tools",
        ],
      },
    },
  },
});
