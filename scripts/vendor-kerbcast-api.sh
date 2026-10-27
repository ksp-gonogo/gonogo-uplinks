#!/usr/bin/env bash
# Pack Kerbcast.API and Kerbcast.API.Testing from a Kerbcast tree into vendor/nuget,
# for the time before Kerbcast.API is on nuget.org.
#
#   scripts/vendor-kerbcast-api.sh <kerbcast tree> <kerbcast commit>
#
# The tree is a Kerbcast checkout or a plain export of one commit; the commit is the
# sha it was taken from, which names the pin. The tree is only read: the two projects
# are copied out and packed elsewhere, so nothing is written into it.
#
# Writes the two packages (removing any earlier Kerbcast.API pin), KerbcastApiVersion
# in Directory.Build.props, and the sha in vendor/kerbcast-ref. The version is the
# API line from Versions.props plus -pin.g and the sha (at most 12 characters of it),
# so NuGet's machine-wide cache can never serve an earlier pin's bytes under it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TREE="${1:-}"
SHA="${2:-}"
if [ -z "$TREE" ] || [ -z "$SHA" ]; then
  echo "usage: $0 <kerbcast tree> <kerbcast commit>"
  exit 2
fi
if ! [[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "✖ vendor-kerbcast-api: $SHA is not a commit sha"
  exit 2
fi
PLUGIN="$(cd "$TREE" 2>/dev/null && pwd)/Plugin"
if [ ! -f "$PLUGIN/Versions.props" ] || [ ! -f "$PLUGIN/Kerbcast.API/Kerbcast.API.csproj" ] \
  || [ ! -f "$PLUGIN/Kerbcast.API.Testing/Kerbcast.API.Testing.csproj" ]; then
  echo "✖ vendor-kerbcast-api: $TREE has no Plugin/Kerbcast.API and Plugin/Kerbcast.API.Testing"
  exit 1
fi

API_LINE="$(sed -n 's:.*<KerbcastApiVersion>\([0-9.]*\)</KerbcastApiVersion>.*:\1:p' "$PLUGIN/Versions.props" | head -1)"
if [ -z "$API_LINE" ]; then
  echo "✖ vendor-kerbcast-api: no KerbcastApiVersion in $PLUGIN/Versions.props"
  exit 1
fi
VERSION="$API_LINE-pin.g${SHA:0:12}"

# Resolved for the same reason as the contract's vendor script: macOS temp paths
# sit behind a /var symlink.
WORK="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/Plugin" "$WORK/out"
cp "$PLUGIN/Versions.props" "$WORK/Plugin/"
for project in Kerbcast.API Kerbcast.API.Testing; do
  rsync -a --exclude bin --exclude obj "$PLUGIN/$project/" "$WORK/Plugin/$project/"
done

for project in Kerbcast.API Kerbcast.API.Testing; do
  dotnet pack "$WORK/Plugin/$project/$project.csproj" -c Release -nologo -v q \
    -p:PackageVersion="$VERSION" -p:ContinuousIntegrationBuild=true -o "$WORK/out"
done

FEED="$ROOT/vendor/nuget"
mkdir -p "$FEED"
rm -f "$FEED"/Kerbcast.API.*.nupkg
cp "$WORK/out/Kerbcast.API.$VERSION.nupkg" "$WORK/out/Kerbcast.API.Testing.$VERSION.nupkg" "$FEED/"

PROPS="$ROOT/Directory.Build.props"
if ! grep -q "<KerbcastApiVersion>" "$PROPS"; then
  echo "✖ vendor-kerbcast-api: $PROPS declares no KerbcastApiVersion to move"
  exit 1
fi
sed -i.bak "s:<KerbcastApiVersion>[^<]*</KerbcastApiVersion>:<KerbcastApiVersion>$VERSION</KerbcastApiVersion>:" "$PROPS"
rm -f "$PROPS.bak"
printf '%s\n' "$SHA" > "$ROOT/vendor/kerbcast-ref"

echo "vendor-kerbcast-api: Kerbcast.API and Kerbcast.API.Testing $VERSION in vendor/nuget, from kerbcast $SHA"
