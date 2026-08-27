# gonogo-uplinks

A multi-Uplink monorepo for Gonogo Uplinks, consuming the shared contracts as
published dependencies rather than as workspace links. Nothing in here reaches
into the `gonogo` repository, and that is the point: an Uplink that can only be
built next to the app is not an example of what anyone else can build.

Adding an Uplink is adding a directory under `uplinks/`. No CI file changes.

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
5. **`server.deps.inline` is mandatory and undocumented.** ui-kit's published dist
   loads under vitest only when Vite processes it rather than pre-bundling it. In
   `gonogo` it is always a pnpm symlink and Vite never pre-bundles a linked
   dependency, so the whole tree is green and the published artifact fails for
   everyone else with `styled.span is not a function`, in setup, before one
   assertion runs. The devkit should ship the vitest config, not the knowledge
6. **Neither published package is resolvable from CJS**, because both declare an
   `import` condition with no `require` one, and neither exports `./package.json`.
   Any build tool that wants to resolve them or read their version hits both
7. **Cross-half parity tests hardcode `../<file>.cs`**, assuming the client sits
   beside the C# sources. Five of scansat's tests failed on the layout here until
   repointed. They are good tests and worth keeping: the fix is a path from
   `uplink.json` rather than a relative guess
