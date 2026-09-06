# Building an Uplink

Reference for the build, the CI checks and what each one is for.

## What you need before anything builds

Four things, none of them ours to redistribute, all resolved through overridable
MSBuild properties (`Directory.Build.props`) so you can point at a different
install and re-run:

| Property | What | Where from |
|---|---|---|
| `KspManaged` | KSP's managed assemblies | your own KSP install, `KSP_x64_Data/Managed` |
| `KspGameData` | the mod this Uplink wraps | your own `GameData` |
| `GonogoContract` | `Sitrep.Contract.dll`, per target framework | `GameData/Gonogo/Plugins/`, installed by GonogoCore |
| `GonogoDevkit` | `Sitrep.Contract.TestSupport.dll`, and for one Uplink `Sitrep.Host.dll` plus the three assemblies it loads | see **What the devkit still owes** |

The client half needs `@ksp-gonogo/sitrep-sdk` and `@ksp-gonogo/ui-kit` from npm,
and nothing else of the app's.

## The full lifecycle, one Uplink

```bash
node scripts/uplink-matrix.mjs                       # what CI will do, per Uplink
cd uplinks/scansat/client && npm ci                  # client dependencies
npm run typecheck && npm test                        # client half
cd - && node tooling/codegen-uplink.mjs scansat      # regenerate committed types
dotnet build  uplinks/scansat/mod/*.csproj -c Release
dotnet test   uplinks/scansat/mod-tests/*.csproj -c Release
node tooling/check-published-loadability.mjs scansat  # can its deps be IMPORTED, in bare node
node scripts/check-nodenext.mjs scansat              # the resolution mode that fails silently
node tooling/check-mod-version.mjs scansat           # parent mod, pinned vs newer
node tooling/bundle-uplink-client.mjs scansat        # artifacts/<id>.client.js + descriptor
node tooling/package-uplink-mod.mjs scansat          # artifacts/<GameData>.zip
```

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
`gonogo-uplink render`, regenerated on demand and never a gate.

The commit-back stages assets by NAME, never by bytes. A PNG re-renders
byte-identically on the same runner; a motion scene's GIF does not, so staging
byte changes would commit a churn asset on every push to `main` forever.

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

The same split applies to typechecking. `bundler` and `nodenext` disagree
SILENTLY: `declare module "./types"` binds under one and not the other, so a
declaration merge vanishes and every key it contributed goes with it. Every Uplink
declares its own Topics through exactly that mechanism, so both modes are checked,
with the count held as a ceiling in `scripts/nodenext-debt.mjs`.

## What the devkit still owes, measured from the outside

Everything below was reconstructed by hand to get this repo green. Each is a
thing an author has to work out for themselves today, and each belongs upstream.

1. **No bundler.** `gonogo-uplink` (from `@ksp-gonogo/ui-kit`) has `render` and
   `docs` and no `bundle`. The only thing that builds an Uplink client bundle is
   an 80-line Vite plugin inside the app. `tooling/bundle-uplink-client.mjs` is
   the reconstruction. It should be `gonogo-uplink bundle`
2. **The externalised-specifier list is published nowhere.** It lives in
   `packages/app/src/uplinks/externals/entries.ts`, so the bundler carries a hand
   copy of a list whose failure mode is a MISSING entry, which a copy agrees with
   by omission. That is how `/spine` shipped unresolvable
3. **`Sitrep.Contract.TestSupport` is `IsPackable=false` and net10.0-only.** Ten
   of the twelve Uplink test projects in `gonogo` reference it, so ten of twelve
   cannot leave. Vendoring one DLL took this Uplink's 78 tests from
   does-not-compile to green
4. **Codegen needs two artifacts nobody ships**: `Sitrep.Contract.Codegen.dll`
   (the RT-attributed twin) and `CodegenTwin.props`. With both vendored, codegen
   from here is byte-identical to the monorepo's committed output, so this is a
   packaging job rather than a design one
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
   own sources. That is why `uplinks/example/client/tsconfig.nodenext.json` has
   exactly one `exclude`, and deleting it is the acceptance test for the fix.
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
