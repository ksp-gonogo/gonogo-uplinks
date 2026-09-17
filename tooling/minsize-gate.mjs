#!/usr/bin/env node
/**
 * Does every widget FIT the `minSize` it declares?
 *
 * A `minSize` is a promise the app enforces as a floor: react-grid-layout
 * refuses to drag a tile below it and a saved layout smaller than it is clamped
 * up, so it is the smallest shape an operator can ever put the widget in.
 * gonogo checks that promise for the widgets living in gonogo
 * (`packages/app/scripts/minsize-gate.ts`), and reads its registration list
 * from the bundle targets precisely so that an Uplink which LEAVES that repo
 * leaves the gate behind with it. Nothing here picked it up, so the six Uplinks
 * already moved, and every one still to move, lost the check at their removal
 * commit. This is that other half.
 *
 * ## It runs against the PUBLISHED packages, like everything else here
 *
 * The audit itself is `auditMinFit`, which ships in `@ksp-gonogo/ui-kit`, so
 * this drives each Uplink's OWN vendored kit through the same render probe the
 * docs render uses rather than carrying a second copy of the measurement. An
 * Uplink that upgrades its kit gets the newer audit; one that has not, gets the
 * one it pinned, which is the version its author is actually building against.
 *
 * The one non-author import is `@ksp-gonogo/sitrep-sdk/registry`, for
 * `getComponents`: the probe's own `readInventory` reports a widget's channels
 * and actions but not its `minSize`, so there is no author-surface way to ask
 * what a widget promised. Adding `minSize` to `InventoryWidget` would retire
 * this, and it is a ui-kit change that reaches here only when the vendor pin
 * moves.
 *
 * ## It proves it can still see
 *
 * Every way this check can quietly stop working (a bundle that registers
 * nothing, a probe that throws before the audit, a kit whose audit lost a rule)
 * produces an empty findings array, and an empty array reads as "everything
 * fits". So two widgets are planted into every Uplink's probe page and the
 * gate refuses to report on that Uplink unless both behave: one broken in ways
 * the audit must name, and one that fits, because a check that called every
 * widget broken would pass the first canary and still be useless.
 *
 * Usage:
 *   node tooling/minsize-gate.mjs                 every client-bearing Uplink
 *   node tooling/minsize-gate.mjs --only <name>   one, for a CI leg
 *   node tooling/minsize-gate.mjs --report        print findings, exit 0
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const report = args.includes("--report");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;

/**
 * Widgets that do not fit the minimum they declare. SHRINK ONLY, and EMPTY.
 *
 * gonogo seeded its equivalent because nineteen of its widgets were already
 * broken when the check first ran and a permanently-red job hides the next real
 * failure. Nothing is grandfathered here: these Uplinks were held to fitting
 * while they lived in gonogo, so an entry appearing in this map is a widget that
 * regressed, not one that was always wrong.
 *
 * The value is the finding KINDS, sorted and comma-joined, because there are
 * only a handful of them and that is stable in a way a per-element count is not:
 * one wrapped row turns four cut-off labels into six without anything changing
 * about the defect.
 */
const KNOWN_MISFITS = new Map();

/** Matches the pinned instant the render harness uses elsewhere. */
const PINNED_UT = 1_000_000;

/**
 * The planted pair, written into the Uplink's own client directory so that every
 * bare specifier in it resolves exactly as that Uplink's source does.
 *
 * It cannot live as a committed file here: `@ksp-gonogo/ui-kit` and
 * `@ksp-gonogo/sitrep-sdk` are installed per client, and a module bundled from
 * `tooling/` would resolve them from the repo root, where neither exists.
 *
 * The broken one is broken in the two ways every version of the audit has
 * named, a heading no tile this size can hold and content behind an
 * `overflow: hidden` with nothing to scroll, rather than in every way the
 * newest one can. The kit is pinned per Uplink, so a canary that demanded the
 * newest audit's full vocabulary would fail as BLIND on an Uplink whose only
 * fault is an older pin.
 */
const PROBE_SOURCE = `
import { registerComponent } from "@ksp-gonogo/sitrep-sdk";
import { getComponents } from "@ksp-gonogo/sitrep-sdk/registry";
import { Panel } from "@ksp-gonogo/ui-kit";

const CANARY_ID = "minsize-gate-canary";
const FITS_ID = "minsize-gate-fits";

function Canary() {
  return (
    <Panel panelTitle="A DELIBERATELY UNREASONABLE TITLE THAT NO TILE THIS SIZE COULD EVER HOLD">
      <div style={{ overflow: "hidden", height: 24 }}>
        <div style={{ height: 400 }}>
          Four hundred pixels of text behind a twenty-four pixel window with
          nothing to scroll
        </div>
      </div>
    </Panel>
  );
}

registerComponent({
  id: CANARY_ID,
  name: "Min-size gate canary",
  description: "Planted by tooling/minsize-gate.mjs: proves the audit can still see a widget that does not fit.",
  tags: ["diagnostics"],
  component: Canary,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 3, h: 3 },
});

function Fits() {
  return <Panel panelTitle="Fits">OK</Panel>;
}

registerComponent({
  id: FITS_ID,
  name: "Min-size gate fitting widget",
  description: "Planted by tooling/minsize-gate.mjs: proves the audit passes a widget that fits.",
  tags: ["diagnostics"],
  component: Fits,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 4 },
});

globalThis.__minsizeCanaryId = CANARY_ID;
globalThis.__minsizeFitsId = FITS_ID;
globalThis.__minsizeWidgets = () =>
  getComponents().map((def) => ({
    id: def.id,
    name: def.name,
    minSize: def.minSize ? { ...def.minSize } : undefined,
    carried: [
      ...new Set([
        ...(def.channels ?? []),
        ...(def.optionalChannels ?? []),
        ...(def.dataRequirements ?? []).map(String),
      ]),
    ],
  }));
`;

/**
 * Where an Uplink's OWN `@ksp-gonogo/ui-kit` subpath is, walking up from its
 * client package and reading the kit's `exports` map.
 *
 * The map rather than a guessed `dist/render.js`, for the reason the sdk's CLI
 * gives for the same walk: guessing reaches past the map and keeps working right
 * up until the kit moves the file. `createRequire().resolve` is the wrong
 * instrument here, it applies the `require` condition and the kit declares only
 * `types` and `import`.
 */
function kitSubpath(clientDir, subpath) {
  let dir = resolve(clientDir);
  for (;;) {
    const pkgDir = join(dir, "node_modules", "@ksp-gonogo", "ui-kit");
    const manifest = join(pkgDir, "package.json");
    if (existsSync(manifest)) {
      const entry = JSON.parse(readFileSync(manifest, "utf8")).exports?.[subpath];
      const file = typeof entry === "string" ? entry : (entry?.import ?? entry?.default);
      if (!file) {
        throw new Error(
          `the @ksp-gonogo/ui-kit at ${pkgDir} exports no "${subpath}", so this version of it cannot run the min-size audit`,
        );
      }
      return join(pkgDir, file);
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `no @ksp-gonogo/ui-kit is installed in ${clientDir} or any directory above it; run npm ci in that client first`,
      );
    }
    dir = parent;
  }
}

/** The finding kinds a set of findings shows, sorted, as the debt records them. */
const kindsOf = (findings) =>
  [...new Set(findings.map((f) => f.kind))].sort().join(", ");

function describe(widget, findings, cap = 4) {
  const min = widget.minSize;
  const head = `    ${widget.id}  "${widget.name}"  min ${min?.w}x${min?.h}`;
  const lines = findings
    .slice(0, cap)
    .map((f) => `        ${f.kind} ${f.px}px [${f.axis}]  "${f.text}"`);
  const more =
    findings.length > cap ? [`        ... and ${findings.length - cap} more`] : [];
  return [head, ...lines, ...more].join("\n");
}

/** Sweep one Uplink. Returns its findings by widget id, or throws if BLIND. */
async function sweep(name) {
  const clientDir = join(ROOT, "uplinks", name, "client");
  const render = await import(pathToFileURL(kitSubpath(clientDir, "./render")).href);
  const { chromium } = createRequire(join(clientDir, "package.json"))("playwright");
  const { RENDER_PROBE_GLOBAL, buildProbePage, gridToPixels, resolveUplinkPackage } =
    render;

  const probeFile = join(clientDir, `.minsize-probe.${process.pid}.tsx`);
  writeFileSync(probeFile, PROBE_SOURCE, "utf8");
  let browser;
  try {
    const page = await buildProbePage(await resolveUplinkPackage(clientDir), [
      probeFile,
    ]);
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 900, height: 900 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    const tab = await context.newPage();
    const pageErrors = [];
    tab.on("pageerror", (err) => pageErrors.push(err.message));
    await tab.goto(pathToFileURL(page.file).toString(), {
      waitUntil: "domcontentloaded",
    });
    await tab.waitForFunction(
      (key) => typeof globalThis[key] === "object",
      RENDER_PROBE_GLOBAL,
      { timeout: 30_000 },
    );

    const mountAndAudit = async (widget) => {
      await tab.evaluate(
        ([key, scene]) => globalThis[key].renderScene(scene),
        [
          RENDER_PROBE_GLOBAL,
          {
            target: { kind: "widget", id: widget.id },
            fixture: `${widget.id}@min`,
            pinnedUt: PINNED_UT,
            carriedChannels: widget.carried,
            emits: [],
            config: {},
            slotProps: {},
            dataSources: {},
            w: widget.minSize.w,
            h: widget.minSize.h,
            ...gridToPixels(widget.minSize.w, widget.minSize.h),
            /*
             * STARVED, which is what this sweep actually is: no data source is
             * registered and nothing is emitted, so the flag changes nothing
             * that gets rendered and only tells the Uplink's own render setup
             * the truth. It matters because a setup hook is author-written and
             * may reasonably demand a sidecar per fixture: kerbcast's throws
             * "no camera for scene" on a fixture name it does not know, and
             * every name this sweep uses is synthetic.
             */
            starve: true,
          },
        ],
      );
      return tab.evaluate((key) => globalThis[key].auditMinFit(), RENDER_PROBE_GLOBAL);
    };

    const all = await tab.evaluate(() => globalThis.__minsizeWidgets());
    const canaryId = await tab.evaluate(() => globalThis.__minsizeCanaryId);
    const fitsId = await tab.evaluate(() => globalThis.__minsizeFitsId);

    const canary = all.find((w) => w.id === canaryId);
    if (!canary?.minSize) {
      throw new Error(
        "the planted canary did not register, so nothing proves the audit still works. Fix PROBE_SOURCE rather than skipping this.",
      );
    }
    const canaryKinds = kindsOf(await mountAndAudit(canary));
    const WANTED = "text-cut-off, title-clipped";
    if (canaryKinds !== WANTED) {
      throw new Error(
        `BLIND. The planted canary ellipsises its own title and hides 400px behind a 24px window with nothing to scroll, and this Uplink's audit reported "${canaryKinds || "(nothing)"}" instead of "${WANTED}". A check that cannot see a violation it planted itself reports zero, and zero reads as success, so no result for this Uplink is trustworthy.`,
      );
    }

    const fits = all.find((w) => w.id === fitsId);
    if (!fits?.minSize) {
      throw new Error(
        "the planted fitting widget did not register, so nothing proves the audit passes a widget that fits.",
      );
    }
    const fitsFindings = await mountAndAudit(fits);
    if (fitsFindings.length > 0) {
      throw new Error(
        `the planted widget fits its tile and the audit reported it anyway, so every finding for this Uplink may be false:\n${describe(fits, fitsFindings, fitsFindings.length)}`,
      );
    }

    const subjects = all
      .filter((w) => w.id !== canaryId && w.id !== fitsId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const declared = subjects.filter((w) => w.minSize);
    if (declared.length === 0) {
      /*
       * An Uplink that draws only augments and contributions owns no tile and
       * has made no promise about one, so there is genuinely nothing here to
       * hold it to. That is asked of the probe's own INVENTORY rather than
       * assumed from the empty sweep, because the two states look identical
       * from here: an Uplink with nothing to check, and a bundle that
       * registered nothing because it threw on the way in.
       */
      const inventory = await tab.evaluate(
        (key) => globalThis[key].readInventory(),
        RENDER_PROBE_GLOBAL,
      );
      const extensions =
        inventory.augments.length + inventory.contributions.length;
      if (inventory.widgets.length === 0 && extensions > 0) {
        return { swept: 0, found: new Map(), detail: [], extensions };
      }
      throw new Error(
        `nothing was examined. The registry holds ${subjects.length} widget(s) of this Uplink and its inventory declares ${inventory.widgets.length}, ${inventory.augments.length} augment(s) and ${inventory.contributions.length} contribution(s). A gate that inspects an empty set reports success for the wrong reason, so this is a failure rather than a pass.`,
      );
    }

    const found = new Map();
    const detail = [];
    for (const widget of declared) {
      const findings = await mountAndAudit(widget);
      if (findings.length === 0) continue;
      found.set(widget.id, kindsOf(findings));
      detail.push(describe(widget, findings));
    }

    if (pageErrors.length > 0) {
      throw new Error(
        `${pageErrors.length} uncaught page error(s), so a widget that threw was audited as if it had rendered:\n  ${[...new Set(pageErrors)].join("\n  ")}`,
      );
    }
    return { swept: declared.length, found, detail };
  } finally {
    if (browser) await browser.close();
    rmSync(probeFile, { force: true });
  }
}

/**
 * Discovered from the same matrix CI iterates, never a list here. An Uplink
 * missing from a hand-kept list is an Uplink this never checks, reported as a
 * clean pass.
 */
const discovered = JSON.parse(
  execFileSync("node", [join(ROOT, "scripts/uplink-matrix.mjs")], {
    encoding: "utf8",
  }),
).filter((leg) => leg.client);

if (discovered.length === 0) {
  console.error(
    "✖ the matrix reported no Uplink with a client, so this examined nothing and would have\n" +
      "  exited clean. Discovery is broken rather than the repo being empty.",
  );
  process.exit(1);
}

const legs = only ? discovered.filter((leg) => leg.name === only) : discovered;
if (legs.length === 0) {
  console.error(
    `✖ --only ${only} matches no client-bearing Uplink. Known: ${discovered.map((l) => l.name).join(", ")}`,
  );
  process.exit(1);
}

const regressions = [];
const fixed = [];
const detail = [];
for (const leg of legs) {
  console.log(`── ${leg.name}`);
  const { swept, found, detail: rows, extensions } = await sweep(leg.name);
  console.log(
    extensions
      ? `   no widgets: ${extensions} augment(s)/contribution(s) and no tile of its own, so no minSize was promised.`
      : `   ${swept} widget(s) rendered at the minSize they declare; ${found.size} do not fit.`,
  );
  detail.push(...rows);
  for (const [id, kinds] of found) {
    const owed = KNOWN_MISFITS.get(id);
    if (owed === undefined) regressions.push(`    ${id}  ${kinds}  (new)`);
    else if (owed !== kinds) {
      regressions.push(`    ${id}  ${kinds}  (recorded as "${owed}")`);
    }
  }
  // Scoping to one Uplink cannot speak about another's entries, so the stale
  // half is only meaningful on a full run.
  if (!only) {
    for (const id of KNOWN_MISFITS.keys()) {
      if (!found.has(id)) fixed.push(id);
    }
  }
}

if (report) {
  if (detail.length > 0) console.log(detail.join("\n"));
  process.exit(0);
}

if (fixed.length > 0) {
  console.error(
    `\n✖ ${fixed.length} recorded misfit(s) now fit at their own declared minSize:\n` +
      fixed.map((id) => `    ${id}`).join("\n") +
      "\n\n  That is the good direction. Delete the line(s) from KNOWN_MISFITS in\n" +
      "  tooling/minsize-gate.mjs; the list may only ever get smaller, and a fixed\n" +
      "  entry left in it is a permission nobody needs.",
  );
  process.exit(1);
}

if (regressions.length > 0) {
  console.error(
    `\n✖ ${regressions.length} widget(s) are unusable at the size they themselves declare\n` +
      `  they can live at:\n\n${regressions.join("\n")}\n\n${detail.join("\n")}\n\n` +
      "  Two ways out, both legitimate:\n" +
      "    - make it fit. A heading that will not wants <Panel compactTitle>; content\n" +
      "      that overflows wants a scroller rather than an overflow:hidden with\n" +
      "      nothing to scroll; a field cut off wants room for its value\n" +
      "    - RAISE its minSize, when the honest answer is that the widget cannot be\n" +
      "      that small. Say so in the commit\n\n" +
      "  Do NOT add it to KNOWN_MISFITS: that list is empty and shrink-only.",
  );
  process.exit(1);
}

console.log(
  `\nevery widget of ${legs.length} Uplink(s) fits the minSize it declares.`,
);
