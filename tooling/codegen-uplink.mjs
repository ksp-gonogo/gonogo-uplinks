#!/usr/bin/env node
/**
 * Regenerates one Uplink's client types from its C# contract slice.
 *
 * The generated TypeScript is committed, so CI runs this and diffs: a slice whose
 * C# moved without a regeneration produces a diff instead of a client that types
 * a payload the mod no longer sends.
 *
 * ## The two artifacts this needs from GonogoCore, and why they are not the DLL
 *
 * Reinforced.Typings drives codegen off `[TsInterface]`/`[TsEnum]` in an
 * assembly's METADATA, and the shipped `Sitrep.Contract.dll` deliberately carries
 * none: a shipped assembly holding those attributes also carries a hard reference
 * to `Reinforced.Typings.dll` that is never deployed beside it, and then every
 * consumer breaks the moment it asks a contract type for its attributes.
 * `Enum.ToString()` asks, because enum formatting looks for `[Flags]`.
 *
 * So codegen reads a codegen-only TWIN: the same sources recompiled with
 * `SITREP_CODEGEN` defined. An Uplink outside the gonogo monorepo therefore needs
 * TWO artifacts that are not the shipped DLL and are published nowhere today:
 *
 *  - `Sitrep.Contract.Codegen.dll`, the twin's output, RT attributes included.
 *    Referenced as a binary rather than as the source project it is in-repo
 *  - `CodegenTwin.props`, the shared shape every twin imports
 *
 * Measured in this pilot: with both in `vendor/contract/`, the extracted twin
 * builds and rtcli emits `contract.ts`, `topic-map.ts` and `units.ts`
 * BYTE-IDENTICAL to the committed ones. Nothing else was needed, which makes the
 * gap a packaging job rather than a design one.
 *
 * `RtConfig` naming is the Uplink's own: `<Name>RtConfig.Configure`, declared in
 * its contract slice, read here from `uplink.json` so this file knows no Uplink.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RT_VERSION = "1.6.7";
const RTCLI = join(
  homedir(),
  ".nuget/packages/reinforced.typings",
  RT_VERSION,
  "tools/net5.0/rtcli.dll",
);

const name = process.argv[2];
const passthrough = process.argv.slice(3);
if (!name) {
  console.error("usage: codegen-uplink.mjs <uplink-dir-name> [-p:Prop=value ...]");
  process.exit(2);
}

const uplinkDir = join(ROOT, "uplinks", name);
const declared = JSON.parse(readFileSync(join(uplinkDir, "uplink.json"), "utf8"));
const codegen = declared.codegen;
if (!codegen) {
  console.log(`${declared.id}: no codegen block in uplink.json, nothing to generate`);
  process.exit(0);
}

const twinDir = join(uplinkDir, "mod-contract-codegen");
const project = join(twinDir, `${codegen.assembly}.Codegen.csproj`);
if (!existsSync(project)) {
  console.error(`✖ ${project} does not exist, so there is no twin to read.`);
  process.exit(1);
}

if (!existsSync(RTCLI)) {
  console.error(
    `✖ rtcli ${RT_VERSION} is not in the NuGet cache at ${RTCLI}.\n` +
      "  It arrives with the twin's Reinforced.Typings PackageReference: build the twin once, or\n" +
      "  run `dotnet restore`, then re-run. Refusing rather than emitting an empty contract.ts.",
  );
  process.exit(1);
}

execFileSync("dotnet", ["build", project, "-v", "minimal", ...passthrough], {
  stdio: "inherit",
});

const outDir = join(uplinkDir, "client", "src", "__generated__");
mkdirSync(outDir, { recursive: true });

/*
 * SourceAssemblies must be ABSOLUTE. rtcli resolves a relative path against its
 * own working directory, fails to load the assembly, and then reports
 * "Cannot find configured fluent method" and "total 0 assemblies loaded" while
 * writing a valid-looking contract.ts holding nothing but a header. It exits 0
 * doing it, so only the committed-output diff catches it.
 */
const assembly = resolve(
  twinDir,
  "bin/Debug/netstandard2.0",
  `${codegen.assembly}.dll`,
);

/*
 * The contract's `///` prose, which reaches the generated TypeScript ONLY through
 * this file. Reinforced.Typings reads an XMLDOC file and never the sources, so
 * without it rtcli reports "0 declarations documented" and writes a contract of
 * bare field names: the same slice the monorepo generates with every explanation
 * attached. The twin emits the XML beside its own assembly (see
 * CodegenTwin.props' GenerateDocumentationFile), so the path is derived from the
 * assembly rather than declared.
 */
const documentation = assembly.replace(/\.dll$/, ".xml");
if (!existsSync(documentation)) {
  console.error(
    `✖ ${documentation} does not exist, so the emitted contract would carry no prose at all.\n` +
      "  It comes from the twin's GenerateDocumentationFile: a vendored CodegenTwin.props predating\n" +
      "  that property builds cleanly and silently drops every doc comment. Refusing.",
  );
  process.exit(1);
}

const env = { ...process.env, DOTNET_ROLL_FORWARD: "LatestMajor" };
for (const [variable, file] of Object.entries(codegen.emits ?? {})) {
  env[variable] = join(outDir, file);
}

execFileSync(
  "dotnet",
  [
    RTCLI,
    `DocumentationFilePath=${documentation}`,
    `SourceAssemblies=${assembly}`,
    `TargetFile=${join(outDir, "contract.ts")}`,
    `ConfigurationMethod=${codegen.configurationMethod}`,
  ],
  { env, stdio: "inherit" },
);

console.log(`${declared.id}: codegen → ${outDir}`);
