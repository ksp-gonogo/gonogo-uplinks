# Changelog

## 1.0.0-rc.5 (2026-10-30)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- kerbcast's aim and sidecar members gate availability, fixture consistency reads career.facilities in its one shape, and the kos parser's contract is named for what it does
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the Uplink matches gonogo's live tree and builds against main's vendored packs
- the Uplink matches gonogo 7005ac56, on packs from the pinned gonogo ref
- a refused kOS command says the terminal is held, the CPU is busy, or it has no terminal
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- every kOS channel and command needs a researched processor, and each MechJeb command is locked as MechJeb locks the window it stands in for, so a career sees the node to research instead of a control the game still withholds
- an Uplink can declare the other mods it needs, and kOS, Kerbalism and Principia need Harmony
- the kOS terminal's input line takes Cmd, Option and Ctrl word, line and delete shortcuts
- every Uplink builds on contract 50, and camera feeds work with Kerbcast 1.12.0-rc.2

### Fixes

- repoint at vendored packs carrying its terminal chrome, and regenerate its page
- stop the client's imports resolving only under a bundler
- take the kit's one console composition, and reach zero under nodenext
- spell the kOS reference paths out, so CI's reference-set check can see them
- a held CPU list still lists the CPUs, and the tests take the kit's and sdk's own helpers
- the terminal says when its screen is held
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- list-only Topics in eight Uplinks show their item units instead of a dash
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- each Gonogo add-on mod reports the version it was released as
- the terminal keeps retrying its connection to the CPU and says why when it is refused
- opening the kOS terminal puts the cursor in it, so you can type without clicking
- opening the kOS terminal puts the cursor in it, so you can type without clicking
- camera feed and libration points input actions use kebab-case ids
- reloading the main screen no longer locks you out of the kOS terminal
- clicking the kOS terminal's input line now takes keystrokes
- the kOS terminal clears its screen after a script run from the widget finishes
- the kOS terminal keeps retrying while the craft has no link and says so before you type
- the kOS terminal reconnects at once after staging, without the empty screen
- the kOS terminal stays routed to its craft while staging moves its CPU to a new vessel
- a second kOS terminal tab takes over once the first one lets go
- the kOS CPU list is back at once when staging changes the active vessel
- the kOS terminal no longer holds a missing CPU on screen for a grace period
- the kOS CPU list is no longer forced back by the Uplink after staging
- a closed kOS terminal tab lets go of the CPU's terminal at once for the next screen
- the kOS terminal no longer keeps the script listing's wrapper text on screen
- a kOS terminal tab that vanishes without closing frees the CPU's terminal within seconds
- the kOS terminal is no longer cleared after the script listing
- the kOS script picker reads each drive's files directly and types nothing into the terminal
- the kOS terminal keeps a script's own output on screen after it runs from the widget
- the kOS script picker no longer lists the Archive when the craft has no link home
- the kOS terminal's input line ignores Alt and other key combinations it has no action for
- the kOS script picker says at once its drives need a link home, then lists them
- closing the kOS script picker cancels the drive listing and ignores a late answer
- the no-path and one-way delay tags draw over the kOS script picker, not under it

## 1.0.0-rc.4 (2026-10-27)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- kerbcast's aim and sidecar members gate availability, fixture consistency reads career.facilities in its one shape, and the kos parser's contract is named for what it does
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the Uplink matches gonogo's live tree and builds against main's vendored packs
- the Uplink matches gonogo 7005ac56, on packs from the pinned gonogo ref
- a refused kOS command says the terminal is held, the CPU is busy, or it has no terminal
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- every kOS channel and command needs a researched processor, and each MechJeb command is locked as MechJeb locks the window it stands in for, so a career sees the node to research instead of a control the game still withholds
- an Uplink can declare the other mods it needs, and kOS, Kerbalism and Principia need Harmony

### Fixes

- repoint at vendored packs carrying its terminal chrome, and regenerate its page
- stop the client's imports resolving only under a bundler
- take the kit's one console composition, and reach zero under nodenext
- spell the kOS reference paths out, so CI's reference-set check can see them
- a held CPU list still lists the CPUs, and the tests take the kit's and sdk's own helpers
- the terminal says when its screen is held
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- list-only Topics in eight Uplinks show their item units instead of a dash
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- each Gonogo add-on mod reports the version it was released as
- the terminal keeps retrying its connection to the CPU and says why when it is refused
- opening the kOS terminal puts the cursor in it, so you can type without clicking
- opening the kOS terminal puts the cursor in it, so you can type without clicking
- camera feed and libration points input actions use kebab-case ids

