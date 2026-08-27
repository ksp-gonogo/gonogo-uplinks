# gonogo-uplinks

A multi-Uplink monorepo for Gonogo Uplinks, consuming the shared contracts as
published dependencies rather than as workspace links. Nothing in here reaches
into the `gonogo` repository, and that is the point: an Uplink that can only be
built next to the app is not an example of what anyone else can build.

Adding an Uplink is adding a directory under `uplinks/`. No CI file changes.

**Start from `uplinks/example/`.** It is the smallest Uplink that is still a real
one: one channel, one widget, no third-party mod, and green on a fresh clone. It
is also the CI's own smoke test, so it cannot rot quietly. Copy it, rename it, and
replace the payload.

```
uplinks/<name>/
  uplink.json                 id, provenance, parent mod, codegen. CI reads THIS
  client/                     the client half, an npm package
  mod/                        the plugin assembly
  mod-contract/               this Uplink's own wire types
  mod-contract-codegen/       codegen-only twin of the slice
  mod-tests/                  the plugin's tests
```

## What you need before anything builds

Four things, none of them ours to redistribute, all resolved through overridable
MSBuild properties (`Directory.Build.props`) so you can point at a different
install and re-run:

| Property | What | Where from |
|---|---|---|
| `KspManaged` | KSP's managed assemblies | your own KSP install, `KSP_x64_Data/Managed` |
| `KspGameData` | the mod this Uplink wraps | your own `GameData` |
| `GonogoContract` | `Sitrep.Contract.dll`, per target framework | `GameData/Gonogo/Plugins/`, installed by GonogoCore |
| `GonogoDevkit` | `Sitrep.Contract.TestSupport.dll` | see **What the devkit still owes** |

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
