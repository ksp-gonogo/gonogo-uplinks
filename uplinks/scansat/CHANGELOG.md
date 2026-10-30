# Changelog

## 1.0.0-rc.5 (2026-10-30)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the Kerbalism, SCANsat and RealAntennas rig tools move out of gonogo core into each Uplink's mod-devtools, built in CI and never packaged
- the client registers its own per-body dynamic Topic prefixes, pinned to the sitrep-sdk from gonogo b50d536a8
- contributed science instruments carry the reading of scansat.science, so Experiments marks them held when it stops arriving, pinned to sitrep-sdk, ui-kit and uplink-tools from gonogo 18de75da4
- a sensor's fov and altitude limits are [SitrepStatic], read off the shipped SCANsat assembly where they are assigned only at sensor registration
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- every grid namespace needs a researched scanner reading the scan type it carries, judged per topic for coverage and masks, so a career sees the node to research for each scan type instead of an empty map
- coverage is captured on demand for every body a client watches, whichever vessel is active, and the mask sync finally has callers, MapView through a draw-nothing overlay and the Minimap for its own body, so a map fills from the save-held coverage SCANsat re-sends on subscribe
- every Uplink builds on contract 50, and camera feeds work with Kerbcast 1.12.0-rc.2

### Fixes

- read the scanning-vessel list off a topic that resolves
- stop eight Uplinks stating readings nobody took
- regenerate the example and SCANsat topic maps against the corrected fleet. header
- stop an unread coverage figure reaching the operator as 0% scanned
- regenerate every committed slice against the current gonogo contract
- move realfuels, scansat, aero and example onto the sdk the host now speaks
- regenerate every client contract for the null the wire sends
- name the body in the anomalies heading only when there is one
- regenerate realfuels, scansat and rp1 for the null-widened reference members, and type rp1's consumers for the null
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the active body's name is absent, not null, when the catalogue names none
- per-body layers and coverage rows read through useStream, and the fog sync gate through the one-arg useTelemetry
- each scanner's type and range badge share a row above its FoV and altitude band, so the badge no longer clips at the default tile
- the altimetry base anchors its colour ramp at sea level on a body with an ocean, so Kerbin's lowland paints as land instead of shallow water
- restore the other Uplinks' pages, which their own pinned tools still write
- scanner footprints draw across the map's edge and in every repeat of the world
- list-only Topics in eight Uplinks show their item units instead of a dash
- map layers follow the Ground Track rename and Scanning puts Uplink sections at its end
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- Scanning and MechJeb tiles declare a minimum size where their headings fit
- each Gonogo add-on mod reports the version it was released as
- camera feed and libration points input actions use kebab-case ids
- the SCANsat Uplink now says it was built against SCANsat 21.1
- the page's held scanners scene expects the held mark, not an OFFLINE chip
- SCANsat maps come back after a quickload or loading another save

## 1.0.0-rc.4 (2026-10-27)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the Kerbalism, SCANsat and RealAntennas rig tools move out of gonogo core into each Uplink's mod-devtools, built in CI and never packaged
- the client registers its own per-body dynamic Topic prefixes, pinned to the sitrep-sdk from gonogo b50d536a8
- contributed science instruments carry the reading of scansat.science, so Experiments marks them held when it stops arriving, pinned to sitrep-sdk, ui-kit and uplink-tools from gonogo 18de75da4
- a sensor's fov and altitude limits are [SitrepStatic], read off the shipped SCANsat assembly where they are assigned only at sensor registration
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- every grid namespace needs a researched scanner reading the scan type it carries, judged per topic for coverage and masks, so a career sees the node to research for each scan type instead of an empty map
- coverage is captured on demand for every body a client watches, whichever vessel is active, and the mask sync finally has callers, MapView through a draw-nothing overlay and the Minimap for its own body, so a map fills from the save-held coverage SCANsat re-sends on subscribe

### Fixes

- read the scanning-vessel list off a topic that resolves
- stop eight Uplinks stating readings nobody took
- regenerate the example and SCANsat topic maps against the corrected fleet. header
- stop an unread coverage figure reaching the operator as 0% scanned
- regenerate every committed slice against the current gonogo contract
- move realfuels, scansat, aero and example onto the sdk the host now speaks
- regenerate every client contract for the null the wire sends
- name the body in the anomalies heading only when there is one
- regenerate realfuels, scansat and rp1 for the null-widened reference members, and type rp1's consumers for the null
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the active body's name is absent, not null, when the catalogue names none
- per-body layers and coverage rows read through useStream, and the fog sync gate through the one-arg useTelemetry
- each scanner's type and range badge share a row above its FoV and altitude band, so the badge no longer clips at the default tile
- the altimetry base anchors its colour ramp at sea level on a body with an ocean, so Kerbin's lowland paints as land instead of shallow water
- restore the other Uplinks' pages, which their own pinned tools still write
- scanner footprints draw across the map's edge and in every repeat of the world
- list-only Topics in eight Uplinks show their item units instead of a dash
- map layers follow the Ground Track rename and Scanning puts Uplink sections at its end
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- Scanning and MechJeb tiles declare a minimum size where their headings fit
- each Gonogo add-on mod reports the version it was released as
- camera feed and libration points input actions use kebab-case ids
- the SCANsat Uplink now says it was built against SCANsat 21.1
- the page's held scanners scene expects the held mark, not an OFFLINE chip

