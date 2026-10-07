# Building an Uplink

Reference for the build, the CI checks and what each one is for.

## What you need before anything builds

An Uplink here is built the way an outside author's is. Everything of Gonogo's
arrives as a package, and only the game is yours to supply:

| What | Where from |
|---|---|
| KSP's managed assemblies (`KspManaged`) | your own KSP install, `KSP_x64_Data/Managed` |
| the mod this Uplink wraps (`KspGameData`) | your own `GameData` |
| `KspGonogo.Sitrep.Contract`, the one NuGet package every C# project references | `vendor/nuget`, which `nuget.config` names as a feed |
| `@ksp-gonogo/sitrep-sdk`, `ui-kit` and `uplink-tools` | the three tarballs in `vendor/`, which each client's `package.json` names |

The first two are not ours to redistribute and stay machine-local. They are
MSBuild properties (`Directory.Build.props`), so `-p:KspManaged=...`, or an
environment variable of the same name, points a build at a different install.

The package is the whole of the C# surface. A plugin and its contract slice
compile against the `Sitrep.Contract` in it (compile-only, since GonogoCore
provides the assembly in the game); a Tests project also gets
`Sitrep.Contract.TestSupport`, the fakes and rule assertions, and `Sitrep.Core`,
the real delay engine; and its `codegen` folder holds the twin and the props
that `uplink-tools codegen` builds an Uplink's client types against. No project
references a loose assembly of Gonogo's.

### The pin

One gonogo commit stands behind all four packages. `vendor/gonogo-ref` names it,
and one line in `Directory.Build.props`, `GonogoContractVersion`, is the version
every project references. The version carries the commit
(`<release>-pin.g<first 12 of the sha>`), because NuGet's machine-wide cache
would otherwise go on serving the first bytes it saw under a version packed
twice.

To move to a newer gonogo, from a gonogo checkout built at that commit:

```bash
scripts/vendor-uplinks-reference-set.sh <this checkout> <sha>   # the nupkg, the version line, vendor/gonogo-ref
# then pack sitrep-sdk, ui-kit and uplink-tools with scripts/pack-publishable.mjs,
# add each to vendor/ under its content-addressed name, and point every client's
# package.json at the new files
```

Then, in every Uplink: `npm install` in `client/`, `uplink-tools codegen`,
`uplink-tools page`, typecheck and test. Commit all of it together: the
generated TypeScript and the manifests are judged against the pin, so a pin that
moved without them is red in every Uplink at once. `scripts/check-vendor-pins.mjs`
holds the pieces to each other.

The vendoring script packs from the COMMIT (`git archive`), never the working
tree, and leaves exactly one package in the feed. Once a release of the package
is on nuget.org, `GonogoContractVersion` becomes that release's version and the
vendored file goes.

The client half needs `@ksp-gonogo/sitrep-sdk` and `@ksp-gonogo/ui-kit` from npm,
and nothing else of the app's.

## Watching a client while you work on it

```bash
pnpm uplink:watch rp1        # rebuilds uplinks/rp1/client on every save
```

It runs the client's own `uplink-tools bundle --watch`, so the bundle is the one
that client's release build would write. To see it in a running app, start a
gonogo checkout with `pnpm dev --uplink <path to uplinks/rp1>`: the app loads the
build output, reports its state under Settings, Uplinks, Local builds, and
reloads the page when the bundle changes. The command needs the client installed
(`npm ci` in its directory) with an sdk new enough to have `--watch`.

## The full lifecycle, one Uplink

Every build step is a command of the published `uplink-tools`, the same ones an
outside author runs. `tooling/uplink-tools.mjs <uplink> <command>` runs one for
an Uplink here with that Uplink's own installed copy; inside `client/` the
`npm run` scripts and `npx uplink-tools` do the same.

```bash
node scripts/uplink-matrix.mjs                       # what CI will do, per Uplink
cd uplinks/scansat/client && npm ci                  # client dependencies
npm run typecheck && npm test                        # client half
npx uplink-tools codegen                             # regenerate committed types (--check: fail on drift)
npx uplink-tools page                                # the generated page, with no browser
cd - && dotnet build  uplinks/scansat/mod/*.csproj -c Release
dotnet test   uplinks/scansat/mod-tests/*.csproj -c Release
node tooling/check-published-loadability.mjs scansat  # can its deps be IMPORTED (or, if bundled, LINKED)
node scripts/check-nodenext.mjs scansat              # the resolution mode that fails silently
node tooling/minsize-gate.mjs --only scansat         # does every widget fit its own minSize (Linux only, see below)
node tooling/check-mod-version.mjs scansat           # parent mod, pinned vs newer
node tooling/uplink-tools.mjs scansat release --out artifacts   # bundle, bake, compile, verify, zip
```

`release` is the order that matters. The app loads an installed Uplink's client
only when its plugin says where the bundle lives and vouches for its hash, so the
bundle is built and hashed, the hash is baked into the plugin's sources, and
only then is the plugin compiled and zipped. `bundle`, `bake` and `package` are
its steps, and each runs alone.

A plugin's manifest reads three generated files, `Provenance.g.cs`,
`ClientSource.g.cs` and `ExpectedClientHash.g.cs`, which are never committed.
`uplink-tools bake` writes them, and a build of a fresh checkout that has none
bakes them first (`Directory.Build.targets`), with no hash.

## Starting a new Uplink

```bash
node tooling/uplink-tools.mjs <a sibling> new <id> --dir "$PWD/uplinks"
```

It goes to `uplinks/<id>/` pinned like its siblings: the same three tarballs and
`$(GonogoContractVersion)`. There is no example Uplink to copy. The scaffold is
the example, and `scripts/scaffold-proof.sh` makes a fresh one on every CI run
and takes it through to a release, so it cannot rot.

## Rig-only dev tools: `mod-devtools/`

An Uplink may carry a `mod-devtools/` project: KSPAddons that poll a request cfg on a
test rig and drive or read the mod in ways no headless test can, such as stamping a
scan, boosting an antenna, or crediting science through the mod's own path. Each one
reaches its mod and gonogo purely by reflection and references only the KSP and Unity
assemblies, so it builds with neither installed. CI builds it (`devtools_csproj` in the
matrix) so it cannot rot, and nothing packages it: deploy it by hand to
`GameData/<AssemblyName>/Plugins`, where each tool reads its cfg from `PluginData`
beside the DLL. A verdict worth testing headlessly is carved into a KSP-free file the
Uplink's `mod-tests` compiles in, as realantennas does with `AntennaProbeVerdicts.cs`.

## The minSize gate only answers honestly on Linux

`minsize-gate.mjs` measures clipping in PIXELS, so macOS and Linux disagree at the
margin — and here that disagreement is a pass/fail, not a prettier picture. On
2026-09-17 CI reported scansat's `scanning` widget as `title-clipped 3px` while the
same command on the same commit reported `0 do not fit` on macOS.

**So a clean local run on a Mac is not evidence.** Reproduce CI in a container, which
does agree with it exactly:

```bash
# $STAGE is a scratch COPY of tooling/, scripts/, package.json, the one uplinks/<id>/
# and the vendored .tgz pins, with node_modules EXCLUDED. npm install inside on the
# first pass. Match the RESOLVED playwright, not the ^ range in the manifest.
podman run --rm -v "$STAGE:/w:Z" -w /w mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -lc 'cd /w && node tooling/minsize-gate.mjs --only <id>'
```

Stage a copy rather than mounting the live worktree: an `npm install` inside Linux
overwrites the macOS binaries your own runs depend on. `scripts/uplink-matrix.mjs`
must be staged, because the gate discovers legs through it.

`uplink-docs --check` compares the pictures and their render-SHAPE hashes only in
CI (`CI` or `GITHUB_ACTIONS` set). Run anywhere else it compares the README, the
manifest and the asset names, and says so, because pictures rendered off the CI
runner differ from the committed ones in ways nobody edited. Pages are
regenerated by `uplink-docs.yml` on the runner, never locally.

## The README, which you do not write

Every Uplink's `client/README.md` is GENERATED, from its registrations, its
generated contract slice, its fixtures, and the one file you do write:
`client/uplink.md`. Nothing else on the page is authored, so nothing else on it
can go stale.

```bash
node tooling/uplink-docs.mjs                 # rewrite every page
node tooling/uplink-docs.mjs --check         # fail on any page that has drifted
node tooling/uplink-docs.mjs --gate          # fail on any Uplink with no page
```

`uplink.md` carries a lede (what the Uplink is for, which mod it wraps, what
someone has to install first) and, where a widget needs more than its own
registered description, a `## widget:<id>` section. A section naming an id
nothing registered fails the build, so prose about a widget you deleted is a
build error rather than a paragraph that quietly disappears.

Three things check it, and each asks something the others cannot:

- `--gate`, once per run in `ci.yml`'s `discover` job: does every client-bearing
  Uplink HAVE a page. It is not implied by `--check`, and the reason is on the
  record: the example Uplink had a `docs:check` script and no page, so its leg was
  asking whether a page it did not have had drifted, and reported green
- `--check --only <name>`, per leg: is that page CURRENT. Needs chromium
- `.github/workflows/uplink-docs.yml`, on a push to `main`: regenerates the pages
  and commits the result back, so `main` heals itself

The last one does not replace the second. A workflow that silently fixes `main`
means nobody ever sees a generator that has quietly stopped emitting a section:
the page would keep being "current" against a generator that no longer produces
it, and every run would agree.

Screenshots live in `client/docs/assets/`, which is COMMITTED, because the
generated page references that path and a gitignored image is one GitHub draws as
a broken icon. `renders/` is the other thing, gitignored: review output from
`uplink-tools render`, regenerated on demand and never a gate.

The commit-back splits a page into its two halves. The prose, the manifest and
`render-shape.json` are staged by BYTES, because each is derived from the
registrations and a change to one is always a real change. A picture is staged by
whether its entry in `render-shape.json` moved, because a motion scene re-encodes
to different bytes from an unchanged tree and staging that would commit a churn
asset on every push to `main` forever. `tooling/stage-pages.mjs` is that rule, and
the step runs `--check` before it pushes: a heal that leaves the checker failing
has not healed.

## The parent mod version, declared per Uplink

`uplink.json`'s `mod` block is where an Uplink states what it wraps and which
version of it the guards were run against.

```json
"mod": { "name": "SCANsat", "tier": "ckan", "ckan": "SCANsat", "builtAgainst": "20.4" }
```

`tier: "ckan"` means the version is machine-enumerable, so CI can tell you a
newer release exists. That is information, not a failure: it means nobody has run
the guards against the new one yet. `tier: "manual"` is for a mod CKAN does not
carry (Principia ships named releases off CKAN with no semver to compare), and it
is not a weaker claim: both tiers are verified against a stated version, and the
only difference is whether anything can discover that a newer one exists. A pin
does not decay. "Built and tested against SCANsat 20.4" stays true forever.

A third state matters as much as the other two: **could not check**. CKAN
unreachable, identifier wrong, mod delisted. It fails loudly and never reads like
either neighbour, because a check that cannot say it failed to look reports
success it did not earn.

## A green test run is not evidence that your dependencies load

Worth knowing before you trust a green run here. Every client sets
`server.deps.inline` for `@ksp-gonogo/*`, and it has to: without it ui-kit's
published bundle throws `styled.span is not a function` at module scope and every
test file dies in `setupFiles` before one assertion runs.

Inlining makes Vite TRANSFORM the dependency, and its resolver performs the
extension search Node refuses to. So a package emitting extensionless relative
specifiers, which no Node process can import, PASSES a vitest run with inlining
on. Measured both ways against the same pre-fix sdk:

| consumer config | extensionless sdk |
|---|---|
| with `deps.inline` | passes |
| without it | ERR_MODULE_NOT_FOUND |

That is how six weeks of an unimportable sdk went unnoticed while every gate was
green. So `tooling/check-published-loadability.mjs` asks the question in a bare
`node` process with no bundler anywhere near it, and reports it separately. Two
different claims: the tests say your code works, that says anyone can install what
it needs.

That bare-Node load is the check for gonogo's own published packages, the ones
whose manifest names gonogo's repository, because an outside author may load them
in Node. A package from anywhere else that the client bundle inlines reaches nobody
except through that bundle, where an extensionless import is normal, so it is
LINKED instead: esbuild, with the bundler's own settings
(`tooling/uplink-bundle-settings.mjs`), must resolve every import of each of its
entry points and find every name imported.

The same split applies to typechecking. `bundler` and `nodenext` disagree
SILENTLY: `declare module "./types"` binds under one and not the other, so a
declaration merge vanishes and every key it contributed goes with it. Every Uplink
declares its own Topics through exactly that mechanism, so both modes are checked,
and `scripts/check-nodenext.mjs` holds every client at zero.

Know what that gate cannot see. tsc raises TS2834/TS2835 only for an import that
BINDS something, so a side-effect import of an unresolvable specifier
(`import "./topics";`) passes a clean nodenext typecheck and fails at runtime
instead. Give those the same extension as the rest; nothing will tell you.

## Scans that hold every Uplink, and bringing one with an arrival

Some properties are checked across the whole tree rather than per Uplink, by the
`tooling/*.test.mjs` files CI's `discover` job runs. One of them is
`tooling/snapshot-ut-fallback.test.mjs`: a capture that runs without a snapshot
takes the live clock, `snapshot?.Ut ?? _host!.NowUt()`, never a literal. Year 1
day 1 is a real instant, so `?.Ut ?? 0.0` stamps a reading with a time nobody
measured, and the branch is usually unreachable, which is why the wrong answer
stays invisible until something upstream makes it live. The scan catches the shape
whatever the receiver is called, because rp1 once shipped `raw?.Ut ?? 0.0` on its
courier handles, which a scan keyed on the name `snapshot` passes.

A departure moves code and leaves behind the tests that constrained it, and each
repo stays green on its own. So when an Uplink arrives, ask of every scan in
`gonogo` that reads its sources: does it constrain this code, and does it come
too? This scan exists because eleven Uplinks left `gonogo` before anyone asked.

## What the devkit still owes, measured from the outside

Everything below was reconstructed by hand to get this repo green. Each is a
thing an author has to work out for themselves today, and each belongs upstream.

1. **Two bundlers.** Closed. This repo wrote `tooling/bundle-uplink-client.mjs`
   before `uplink-tools bundle` existed and released through it for a while
   after. It is deleted, with the four scripts beside it (codegen, bake, package,
   release): every build step here is the published command
2. **The externalised-specifier list is published nowhere.** It lives in
   `packages/app/src/uplinks/externals/entries.ts`, so the bundler carries a hand
   copy of a list whose failure mode is a MISSING entry, which a copy agrees with
   by omission. That is how `/spine` shipped unresolvable
3. **`Sitrep.Contract.TestSupport` was not a package.** Closed. Ten of the
   twelve Uplink test projects in `gonogo` referenced it, so ten of twelve could
   not leave. It ships in the net10.0 group of `KspGonogo.Sitrep.Contract`, with
   `Sitrep.Core` beside it, and a Tests project here references that package
4. **Codegen needed two artifacts nobody shipped**: the RT-attributed twin of
   `Sitrep.Contract` and `CodegenTwin.props`. Closed. Both ride in the same
   package's `codegen` folder, outside every lib group so nothing can bind the
   twin by accident, and `uplink-tools codegen` finds them through the package
   the contract slice restored
5. **ui-kit's published bundle cannot be loaded, and `server.deps.inline` only
   hides it.** Two named imports of CommonJS dependencies survive into its ESM
   dist: `styled` from styled-components (which publishes no `exports` field, so
   Node takes its CJS `main` and the default arrives as a namespace) and
   `toHaveNoViolations` from jest-axe. Plain `node -e 'import("@ksp-gonogo/ui-kit")'`
   throws `styled.span is not a function` at module scope, and
   `@ksp-gonogo/ui-kit/testing` throws on the jest-axe import, which takes out
   `expectNoA11yViolations`, the a11y helper every widget test is told to call.
   Under vitest it presents as every test file dying in setup before one assertion
   runs. `server.deps.inline` makes Vite process the file instead of pre-bundling
   it, which is what a pnpm symlink gets for free in `gonogo` and is why the whole
   tree is green there. This repo carries that line, and it is a workaround: the
   fix is defensive default resolution in ui-kit's build. `gonogo`'s extraction
   probe now has a load leg that reproduces both, with the two specifiers in a
   `LOAD_EXEMPT` list that fails as stale the moment they load
6. **Neither published package is resolvable from CJS**, because both declare an
   `import` condition with no `require` one, and neither exports `./package.json`.
   Any build tool that wants to resolve them or read their version hits both
7. **Cross-half parity tests hardcode `../<file>.cs`**, assuming the client sits
   beside the C# sources. Five of scansat's tests failed on the layout here until
   repointed. They are good tests and worth keeping: the fix is a path from
   `uplink.json` rather than a relative guess
8. **The unit-map codegen emits extensionless relative imports.** `topic-map.ts`
   carries `from "./contract"`, which is TS2835 under `moduleResolution: nodenext`,
   so an Uplink cannot pass a nodenext typecheck however carefully it writes its
   own sources.
   Checking both modes matters because they disagree SILENTLY: `declare module
   "./types"` binds under `bundler` and does not bind under `nodenext`, so a
   declaration merge vanishes and every key it contributed goes with it, which is
   the pattern `TopicPayloadMap` uses for an Uplink's own Topics

9. **There is no headless host to test an ELECTION against, and it turned out
   not to be needed.** A capability provider is not exercised by the seam alone:
   the question that matters is which provider wins when core resolves, and in
   what discovery order. `Kernel` itself is in `Sitrep.Contract` and reachable,
   but the capability's own registration helper
   (`Sitrep.Host.ActionGroups.ActionGroupsElection`) and the two-pass discovery
   that orders it (`ChannelEngine`, `UplinkDiscovery`) are not. So
   `actiongroupsextended` used to compile its test project against a vendored
   `Sitrep.Host.dll`, with `Sitrep.Core`, `Sitrep.Propagation` and
   `Sitrep.Transport` copied beside it for the runtime, and that was the largest
   outstanding contradiction of the isolation rule in this repo. It is gone, and
   none of the three fixes was a headless host: the capability id moved to
   `Sitrep.Contract` as `ActionGroupsCapability.Id`, so both halves read one
   declaration instead of pinning two spellings equal; the cases that needed
   `ChannelEngine` were asserting CORE's discovery ordering through a
   hand-written double of the Uplink, so they belonged in core's own suite and
   moved there; and the probe host is now `RecordingUplinkHost.cs` in the Tests
   project, over a real `Kernel` with the capability declared on it. That is
   what "Testing a NEW Uplink" in `gonogo`'s `docs/uplink-isolation.md` tells a
   new Uplink to write anyway. Before concluding an election needs core, check
   whether the assertion is actually about core, and whether a real `Kernel` and
   a per-Uplink double will carry the rest. A devkit harness would still be
   worth having, so an author does not write that double from scratch, but it is
   a convenience now rather than the thing standing between this Uplink and the
   rule

10. **No shipped epoch-fallback assertion.** The scan above holds this repo, and
   `gonogo`'s `SnapshotUtFallbackScanTests` holds core, but an Uplink outside both
   repos has nothing. It is a regex over sources, needing no private assembly, so
   it belongs in `Sitrep.Contract.TestSupport` beside `UnitCoverageAssertion` as a
   `SnapshotUtAssertion` an author calls from their own suite over their own
   source directory
