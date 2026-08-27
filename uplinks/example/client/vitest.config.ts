import { defineConfig } from "vitest/config";

// No `@ksp-gonogo/*` aliases. This client imports only published packages, so
// everything resolves out of its own node_modules the way it would for any
// author. An alias pointing one of them at a `src` directory is exactly what
// lets a test reach API that was never published.
export default defineConfig({
  test: {
    name: "example",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // `**/node_modules/**`, not `node_modules/**`. Overriding `exclude` replaces
    // vitest's default list, and the sdk's workspace tarball ships its own `src`
    // with test files in it, so the unanchored glob collects them all and the run
    // dies before reaching this Uplink's own tests.
    exclude: ["dist/**", "**/node_modules/**"],
    // ui-kit and the sdk are processed by Vite rather than pre-bundled. Their
    // published bundles carry named imports of CommonJS dependencies
    // (styled-components, jest-axe) that Node's ESM loader cannot resolve, and
    // pre-bundling preserves that. In the gonogo monorepo both are pnpm symlinks
    // and Vite never pre-bundles a linked dependency, so this is what the
    // first-party clients get for free and an installed copy does not.
    server: {
      deps: {
        inline: ["@ksp-gonogo/ui-kit", "@ksp-gonogo/sitrep-sdk"],
      },
    },
  },
});
