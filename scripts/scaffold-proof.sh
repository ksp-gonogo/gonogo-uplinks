#!/usr/bin/env bash
# Holds `uplink-tools new` to the claim that it hands an author an Uplink that
# builds: scaffold one next to the real ones, then build and test it the way
# every other leg does. A scaffold nobody proves rots silently, because the
# template and the toolchain it feeds change on different days.
#
#   scripts/scaffold-proof.sh <sibling>
#
# <sibling> is an Uplink whose client has its dependencies installed, so its
# `uplink-tools` is the one run, and whose pins the scaffold inherits. Needs the
# reference set (vendor/contract, vendor/devkit, vendor/ksp-managed) resolved.
set -euo pipefail

sibling="${1:?usage: scripts/scaffold-proof.sh <sibling>}"
id="scaffoldproof"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

cli="$root/uplinks/$sibling/client/node_modules/.bin/uplink-tools"
if [ ! -x "$cli" ]; then
  echo "::error::$cli is missing: install the $sibling client first"
  exit 1
fi

trap 'rm -rf "$root/uplinks/$id"' EXIT
rm -rf "$root/uplinks/$id"

"$cli" new "$id"

# A scaffold that emitted nothing would pass everything below by vacuity.
for path in uplink.json mod mod-contract mod-tests client/package.json client/src/__generated__/contract.ts; do
  if [ ! -e "uplinks/$id/$path" ]; then
    echo "::error::the scaffold did not produce uplinks/$id/$path"
    exit 1
  fi
done

node tooling/bake-client-source.mjs "$id"
dotnet build "uplinks/$id/mod/GonogoScaffoldproofUplink.csproj" -c Release --nologo
dotnet test "uplinks/$id/mod-tests" -c Release --nologo

cd "uplinks/$id/client"
npm install --no-audit --no-fund
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.nodenext.json
# The page is generated, and the scaffold leaves it for its author to write, so
# the suite's own page test is satisfied the way the scaffold's next steps say.
# CI is unset for this one write because the page gate refuses an update under
# CI; the plain run after it is the check, and the whole Uplink is deleted.
env -u CI GONOGO_UPLINK_PAGE_UPDATE=1 npx vitest run
npx vitest run
