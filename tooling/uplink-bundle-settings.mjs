/**
 * How an Uplink client is bundled, shared by the bundler and by every check that
 * has to reason about the bundle rather than about bare Node.
 *
 * A check that links a dependency "the way the client consumes it" is only as
 * good as its agreement with the real build: a second copy of these settings
 * that drifted (a missing external, another platform) would prove a bundle
 * nobody ships. So there is one copy, here.
 *
 * ## The externals list is the one thing that is not derivable
 *
 * The externalised specifiers live in gonogo's
 * `packages/app/src/uplinks/externals/entries.ts` and are published nowhere, so
 * the list below is a HAND COPY, and a hand copy of a list whose defect mode is
 * a MISSING entry agrees with the original by omission. A missing entry survives
 * typecheck, the isolation ratchets and the build, then throws at
 * `import(bundleUrl)`, which is exactly how `/spine` shipped unresolvable. The
 * fix is for the sdk to export it; until then the copy is a known liability and
 * this comment is the record of it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const EXTERNALS = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "styled-components",
  "@ksp-gonogo/core",
  "@ksp-gonogo/components",
  "@ksp-gonogo/data",
  "@ksp-gonogo/ui",
  "@ksp-gonogo/ui-kit",
  "@ksp-gonogo/sitrep-client",
  "@ksp-gonogo/sitrep-sdk",
  "@ksp-gonogo/sitrep-sdk/frames",
  "@ksp-gonogo/sitrep-sdk/media",
  "@ksp-gonogo/sitrep-sdk/spine",
  "@ksp-gonogo/logger",
  // Externalised so esbuild leaves them alone; nothing resolves them at load.
  "react-dom/client",
  "react/jsx-dev-runtime",
];

/**
 * Every CSS import folded into the single JS bundle as a self-injecting
 * <style>. The loader fetches only the JS, so a sibling `.css` esbuild emitted
 * would never be applied and the widget would render unstyled with nothing
 * failing. Folding it in also keeps the whole client under ONE integrity hash.
 */
const cssInject = {
  name: "gonogo-css-inject",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.css$/ }, (args) => ({
      loader: "js",
      contents:
        'if (typeof document !== "undefined") {' +
        "const s = document.createElement('style');" +
        `s.textContent = ${JSON.stringify(readFileSync(args.path, "utf8"))};` +
        "document.head.appendChild(s);}",
    }));
  },
};

/** The client's own entry, the one module the app `import()`s. */
export const clientEntry = (clientDir) => join(clientDir, "src/index.ts");

/** esbuild options for an Uplink client bundle, minus where it reads from and writes to. */
export const BUNDLE_OPTIONS = {
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  external: EXTERNALS,
  plugins: [cssInject],
};
