#!/usr/bin/env bash
# Holds `uplink-tools new` to the claim that it hands an author an Uplink that
# builds: scaffold one next to the real ones, then run the commands its own
# closing message names, through to a release. A scaffold nobody proves rots
# silently, because the seed and the toolchain it feeds change on different days.
#
#   scripts/scaffold-proof.sh <sibling>
#
# <sibling> is an Uplink whose client has its dependencies installed, so its
# `uplink-tools` is the one run, and whose pins the scaffold inherits: the three
# vendored tarballs and the contract package version this repo is pinned to.
#
# This repo no longer keeps an example Uplink. The scaffold is the example, made
# fresh on every run, and it is deleted when the run ends.
set -euo pipefail

sibling="${1:?usage: scripts/scaffold-proof.sh <sibling>}"
id="scaffoldproof"
ns="GonogoScaffoldproofUplink"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ ! -d "uplinks/$sibling/client/node_modules/@ksp-gonogo/uplink-tools" ]; then
  echo "::error::uplinks/$sibling/client has no uplink-tools installed: install the $sibling client first"
  exit 1
fi

out="$(mktemp -d)"
trap 'rm -rf "$root/uplinks/$id" "$out"' EXIT
rm -rf "$root/uplinks/$id"

# No browser for any of it: an author's first page and first release need none,
# and a machine with one cached would never show that a step had started to.
export PLAYWRIGHT_BROWSERS_PATH="$out/no-browsers"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"

# The files only. The steps `new` would run itself are run one by one below, so
# a failure names the step.
# There is no terminal here, so every question `new` would ask is answered: by
# --yes for most, by name where there is no default to take. The repository is
# not asked for, since a new Uplink beside siblings is published from theirs.
node tooling/uplink-tools.mjs "$sibling" new "$id" --dir "$root/uplinks" \
  --yes --author "Scaffold Proof" --no-install --no-generate

# A scaffold that emitted nothing would pass everything below by vacuity.
for path in uplink.json mod mod-contract mod-tests client/package.json mod/Provenance.g.cs; do
  if [ ! -e "uplinks/$id/$path" ]; then
    echo "::error::the scaffold did not produce uplinks/$id/$path"
    exit 1
  fi
done

cd "uplinks/$id/client"
npm install --no-audit --no-fund
npm run codegen
npm run page
npm run codegen:check
npm run typecheck
npm test
dotnet test ../mod-tests -c Release --nologo
npm run release -- --out "$out/artifacts"

for path in "$id/$id.client.js" "$id/gonogo-uplink.json" "$ns.zip"; do
  if [ ! -f "$out/artifacts/$path" ]; then
    echo "::error::the scaffold's release did not produce $path"
    exit 1
  fi
done
# GonogoCore provides Sitrep.Contract.dll in the game, and a second copy in another GameData folder is a second set of types.
if unzip -Z1 "$out/artifacts/$ns.zip" | grep -q "Sitrep.Contract.dll"; then
  echo "::error::the scaffold's mod zip carries Sitrep.Contract.dll"
  exit 1
fi
echo "scaffold-proof: a fresh scaffold generates, typechecks, tests on both halves and releases"
