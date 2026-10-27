# Changelog

## 1.0.0-rc.2 (2026-10-27)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker

### Fixes

- state what Avionics, RealFuels and Aerodynamics do, matching gonogo's rewrite
- scope the engine channels to the reported vessel, not the kerbal
- repoint at the current packs, and read a reckoning off its own discriminant
- stop eight Uplinks stating readings nobody took
- stop a tank nobody could classify reporting a vessel that never boils off
- regenerate every committed slice against the current gonogo contract
- render the ignition section in a stand-in host, so the page builds outside gonogo
- move realfuels, scansat, aero and example onto the sdk the host now speaks
- regenerate every client contract for the null the wire sends
- install uplink-tools, which now renders the page the sdk CLI used to render through ui-kit
- regenerate realfuels, scansat and rp1 for the null-widened reference members, and type rp1's consumers for the null
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- list-only Topics in eight Uplinks show their item units instead of a dash
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- each Gonogo add-on mod reports the version it was released as

