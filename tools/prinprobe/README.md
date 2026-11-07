# prinprobe

A development instrument for checking the Principia Uplink's private copy against the game's own Principia from an identical state. It is never packaged and never shipped: it sits outside `uplinks/`, so no release reads it.

## Parts

- `probe/`: `GonogoPrinProbe.dll`, a KSP plugin. Install it as `GameData/GonogoPrinProbe/Plugins/GonogoPrinProbe.dll`. It reads Principia through its own managed forwarder by reflection and patches nothing
- `probe-tests/`: the record format, tested with no game
- `compare.mjs`: sets the copy's path, and optionally the game's flight-plan coast, beside the recorded flown states

## Build

```
dotnet build tools/prinprobe/probe/GonogoPrinProbe.csproj -p:KspManaged=<KSP>/KSP_Data/Managed
dotnet test tools/prinprobe/probe-tests/GonogoPrinProbe.Tests.csproj
node --test tools/prinprobe/compare.test.mjs
```

## Use in the game

Create these files in `GameData/GonogoPrinProbe/PluginData/`. Each is read once, then deleted:

| file | contents | does |
| --- | --- | --- |
| `go` | game seconds, default 3600 | records `flown-<ut>.jsonl` every fixed update until that UT, and writes the seed file `GameData/GonogoPrincipiaUplink/Plugins/prinprobe-seed.json` |
| `plan` | game seconds, default 3600 | disposable saves only: coasts a flight plan with no manoeuvres at the craft's prediction settings, records `plan-<ut>.jsonl`, deletes the plan. Refuses if the craft already has a flight plan |
| `stop` | nothing | stops recording |

While `prinprobe-seed.json` exists, every accurate ask to the Principia Uplink starts from it, and each solved path is written beside it as `prinprobe-path-<ut>.jsonl`. Delete the file to return to normal asks.

```
node tools/prinprobe/compare.mjs --flown flown-<ut>.jsonl --path prinprobe-path-<ut>.jsonl [--plan plan-<ut>.jsonl]
```
