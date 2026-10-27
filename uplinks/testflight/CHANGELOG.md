# Changelog

## 1.0.0-rc.2 (2026-10-27)

### Breaking changes

- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- publish TestFlight's own engine reliability and testflight.repair, drawn on the fleet roster's active craft row
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker

### Fixes

- stop an unread liveness flag putting another engine config's reliability on screen
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of each of these Uplinks
- list-only Topics in eight Uplinks show their item units instead of a dash
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- engine failure updates use the Vessel Catalog widget slot
- engine failure updates use the Vessel Catalog widget slot
- each Gonogo add-on mod reports the version it was released as
- Kerbalism and TestFlight stay available when they model part reliability
- a Kerbalism or TestFlight failure kept after the link drops shows OFFLINE in amber

