import { defineConfig } from "vitest/config";

// No `@ksp-gonogo/*` aliases. This client imports only published packages, so
// everything resolves from its own node_modules the way it would for an author
// outside this repo. A `@ksp-gonogo/*` alias pointing a private package at its
// `src` is exactly what lets a harness reach into one.

export default defineConfig({
  test: {
    // 30s, not the 5s default. The FIRST test in a file pays that file's cold
    // start (first render, first jsdom layout, first styled-components
    // injection): measured at 208ms against 26-38ms for its siblings here, and
    // 223ms against 7-13ms in another Uplink client. Under a parallel `turbo test`
    // on a two-core runner every package pays that at once and the heaviest one
    // loses, which surfaces as a named test "failing" when nothing is wrong with
    // it. Two Uplink clients tripped it on consecutive days; this sets it across
    // all of them rather than waiting for the third. A genuine hang still fails,
    // just later.
    testTimeout: 30_000,
    pool: "threads", // forks EPERM on macOS+Node24; matches packages/components config
    name: "realfuels",
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
        inline: ["@ksp-gonogo/ui-kit", "@ksp-gonogo/sitrep-sdk"],
      },
    },
  },
});
