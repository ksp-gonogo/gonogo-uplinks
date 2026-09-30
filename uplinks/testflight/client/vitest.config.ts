import { defineConfig } from "vitest/config";

// No `@ksp-gonogo/*` aliases. This client imports only published packages, so
// everything resolves from its own node_modules the way it would for an author
// outside this repo. A `@ksp-gonogo/*` alias pointing a private package at its
// `src` is exactly what lets a harness reach into one.

export default defineConfig({
  test: {
    // A cold first render per file can pass the 5s default on a small runner.
    testTimeout: 30_000,
    pool: "threads", // forks EPERM on macOS+Node24; matches the other Uplink clients
    name: "testflight",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // `**/node_modules/**`, not `node_modules/**`. Overriding `exclude` replaces
    // vitest's default list, and the sdk tarball ships its own `src` with test
    // files in it, so the unanchored glob collects them all and the run dies
    // before reaching this Uplink's own tests.
    exclude: ["dist/**", "**/node_modules/**"],
    // ui-kit and the sdk are processed by Vite rather than pre-bundled by
    // esbuild. In the gonogo monorepo both are pnpm symlinks, and Vite never
    // pre-bundles a linked dependency, so this is what a first-party client gets
    // for free. Installed normally, as any author outside that repo installs
    // them, ui-kit's dist goes through the optimizer and its `styled-components`
    // default import comes back as a namespace: every test file then dies in
    // setup with "styled.span is not a function", before one assertion runs.
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
