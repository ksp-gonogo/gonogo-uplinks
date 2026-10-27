# Changelog

## 1.0.0-rc.2 (2026-10-27)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the MechJeb2 remote-autopilot Uplink arrives from gonogo
- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- every kOS channel and command needs a researched processor, and each MechJeb command is locked as MechJeb locks the window it stands in for, so a career sees the node to research instead of a control the game still withholds

### Fixes

- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the unavailable reason reads the uplink roster as a reading, held or current
- every delayed command declares the Subject topic it acts on
- the unlock gate is registered before the version guard can return, so a MechJeb whose API drifted answers Unknown with its reason instead of leaving a declared gate kind unevaluated, which stops the whole mod from starting
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- Scanning and MechJeb tiles declare a minimum size where their headings fit
- each Gonogo add-on mod reports the version it was released as
- camera feed and libration points input actions use kebab-case ids

