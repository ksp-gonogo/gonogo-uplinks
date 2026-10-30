# Changelog

## 1.0.0-rc.6 (2026-10-30)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- a figure that stopped arriving is held, and a tooling scan keeps the other phrasing out
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the Uplink matches gonogo's live tree and builds against main's vendored packs
- the Uplink matches gonogo 5fe8977d, the commit vendor/gonogo-ref pins, and its Tests project carries its own golden fixtures
- the Uplink matches gonogo 8d4749fc on the contract-18 packs, carrying the held-reading work
- the greenhouse, ship map tank levels and file manager mark held figures, from gonogo 0a7cddd32
- a death clock is shown as the margin left to act, measured to when a command sent now would land
- the margin to act counts from the received edge, with the crew model's figure for the craft's present beside it under the modelled mark
- Ship Systems draws the resource model's level and time to empty for the craft's present beside each observed figure under light time
- file, sample and science refusals name what Kerbalism would not do
- Kerbalism lists and reads its reliability settings, and Kerbcast's main-render throttle is a writable mod setting in place of its custom settings tab
- the Kerbalism, SCANsat and RealAntennas rig tools move out of gonogo core into each Uplink's mod-devtools, built in CI and never packaged
- publish Kerbalism's own reliability topics and kerbalism.repair, with the repair-kit cost beside the fleet roster's repair control
- Ship Systems' row time is the resource model's crossing less the view time, and the widget's own countdown is gone
- a Ship Systems level Kerbalism reports as not moving reads stable, and an unreported rate still shows no time
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- a wear gauge's time to empty is the resource model's boundary crossing, with the profile's declared drain fed in as its rate, so the Wear rows keep no countdown of their own
- a transmitting file draws its data transfer on the delay rail as continuous fire-and-forget telemetry, fed only by observed drive readings and never drawn idle when the rate is unread
- fuel and charge predictions run until the craft next enters or leaves shadow
- water or air prediction stops when the process feeding it runs out of input
- Kerbalism experiments, scanners and its lab can be switched on and off from Experiments
- an Uplink can declare the other mods it needs, and kOS, Kerbalism and Principia need Harmony
- experiments show progress and why they wait, and science rows label each figure
- the Science Data archive shows the science the craft has transmitted
- a crew row shows whether the craft is safe for EVA
- CommNet Signal shows a data rate from RealAntennas, or Kerbalism's with its target
- Ship Systems says whether the craft is in sunlight and how exposed its panels are
- Ship Systems opens Kerbalism's automation, log and failures windows
- Ship Systems switches devices and sets script states from its Auto window
- Ship Systems shows pressure and sunlight and runs Kerbalism automation
- every Uplink builds on contract 50, and camera feeds work with Kerbcast 1.12.0-rc.2

### Fixes

- repoint at vendored packs carrying its badge and reckoning API
- stop the client's imports resolving only under a bundler
- nothing reads or names vessel.state, and the plottability probe stops claiming a derived reckoning
- the resource model carries a current reading across the light time to the craft's present
- Ship Systems and Crew Survival draw a modelled figure only where the kit's standsApart rule says it reads apart, and never beside a held margin
- resource reckoner decline notes state what is missing, not how the model works
- the crew margin to act counts the reckoned arm on the modelled roster's death clock, now that deriveReading hands it the array whole
- a wear row's drain is null when the process capacity or per-capacity input is unreadable, so an unknown time no longer reads as steady
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of each of these Uplinks
- list-only Topics in eight Uplinks show their item units instead of a dash
- the radiation graph and crew survival meters draw with the current ui-kit
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- science from a recovered craft credits at once, in range or not
- the radiation trend draws with the Graph the current kit publishes
- the solar storm overlay and repair updates use the current widget slot names
- the radiation trend draws with the Graph the current kit publishes
- each Gonogo add-on mod reports the version it was released as
- Ship Systems follows the level, so a falling charge never reads full in
- Ship Systems stops redrawing its badges every reading, and camera logs are quieter
- each experiment shows its own name and whether it is running
- Kerbalism and TestFlight stay available when they model part reliability
- camera feed and libration points input actions use kebab-case ids
- find Kerbalism 3.32 when it loads after the Uplink starts
- Kerbalism commands, science and ISRU work when Kerbalism loads late
- the reliability parts topic is declared in full again so its client registers it
- a Kerbalism or TestFlight failure kept after the link drops shows OFFLINE in amber
- the Uplink reports Kerbalism available only once every handle is bound
- scanners start and stop on Kerbalism 3.32
- the science widget offers Transmit only for an instrument whose data is on a drive
- a supply is only flagged as running low once it is empty or under its low threshold
- Space Weather shows a very small habitat dose instead of 0.000 rad/h
- reliability part titles no longer carry raw colour markup
- a supply is only flagged as running low once it is empty or under its low threshold
- Space Weather shows a very small habitat dose instead of 0.000 rad/h
- reliability part titles no longer carry raw colour markup
- Ship Systems no longer shows limiting factors or a status once the craft is gone
- Ship Systems opens large enough to show its supplies without cutting off their values
- the experiment progress row has a render scene and the Uplink page is current
- Log and Failures counts read as plain text and the part name is a tag

## 1.0.0-rc.5 (2026-10-27)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- a figure that stopped arriving is held, and a tooling scan keeps the other phrasing out
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the Uplink matches gonogo's live tree and builds against main's vendored packs
- the Uplink matches gonogo 5fe8977d, the commit vendor/gonogo-ref pins, and its Tests project carries its own golden fixtures
- the Uplink matches gonogo 8d4749fc on the contract-18 packs, carrying the held-reading work
- the greenhouse, ship map tank levels and file manager mark held figures, from gonogo 0a7cddd32
- a death clock is shown as the margin left to act, measured to when a command sent now would land
- the margin to act counts from the received edge, with the crew model's figure for the craft's present beside it under the modelled mark
- Ship Systems draws the resource model's level and time to empty for the craft's present beside each observed figure under light time
- file, sample and science refusals name what Kerbalism would not do
- Kerbalism lists and reads its reliability settings, and Kerbcast's main-render throttle is a writable mod setting in place of its custom settings tab
- the Kerbalism, SCANsat and RealAntennas rig tools move out of gonogo core into each Uplink's mod-devtools, built in CI and never packaged
- publish Kerbalism's own reliability topics and kerbalism.repair, with the repair-kit cost beside the fleet roster's repair control
- Ship Systems' row time is the resource model's crossing less the view time, and the widget's own countdown is gone
- a Ship Systems level Kerbalism reports as not moving reads stable, and an unreported rate still shows no time
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- a wear gauge's time to empty is the resource model's boundary crossing, with the profile's declared drain fed in as its rate, so the Wear rows keep no countdown of their own
- a transmitting file draws its data transfer on the delay rail as continuous fire-and-forget telemetry, fed only by observed drive readings and never drawn idle when the rate is unread
- fuel and charge predictions run until the craft next enters or leaves shadow
- water or air prediction stops when the process feeding it runs out of input
- Kerbalism experiments, scanners and its lab can be switched on and off from Experiments
- an Uplink can declare the other mods it needs, and kOS, Kerbalism and Principia need Harmony
- experiments show progress and why they wait, and science rows label each figure

### Fixes

- repoint at vendored packs carrying its badge and reckoning API
- stop the client's imports resolving only under a bundler
- nothing reads or names vessel.state, and the plottability probe stops claiming a derived reckoning
- the resource model carries a current reading across the light time to the craft's present
- Ship Systems and Crew Survival draw a modelled figure only where the kit's standsApart rule says it reads apart, and never beside a held margin
- resource reckoner decline notes state what is missing, not how the model works
- the crew margin to act counts the reckoned arm on the modelled roster's death clock, now that deriveReading hands it the array whole
- a wear row's drain is null when the process capacity or per-capacity input is unreadable, so an unknown time no longer reads as steady
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of each of these Uplinks
- list-only Topics in eight Uplinks show their item units instead of a dash
- the radiation graph and crew survival meters draw with the current ui-kit
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- science from a recovered craft credits at once, in range or not
- the radiation trend draws with the Graph the current kit publishes
- the solar storm overlay and repair updates use the current widget slot names
- the radiation trend draws with the Graph the current kit publishes
- each Gonogo add-on mod reports the version it was released as
- Ship Systems follows the level, so a falling charge never reads full in
- Ship Systems stops redrawing its badges every reading, and camera logs are quieter
- each experiment shows its own name and whether it is running
- Kerbalism and TestFlight stay available when they model part reliability
- camera feed and libration points input actions use kebab-case ids
- find Kerbalism 3.32 when it loads after the Uplink starts
- Kerbalism commands, science and ISRU work when Kerbalism loads late
- the reliability parts topic is declared in full again so its client registers it
- a Kerbalism or TestFlight failure kept after the link drops shows OFFLINE in amber
- the Uplink reports Kerbalism available only once every handle is bound
- scanners start and stop on Kerbalism 3.32
- the science widget offers Transmit only for an instrument whose data is on a drive
- a supply is only flagged as running low once it is empty or under its low threshold
- Space Weather shows a very small habitat dose instead of 0.000 rad/h
- reliability part titles no longer carry raw colour markup
- a supply is only flagged as running low once it is empty or under its low threshold
- Space Weather shows a very small habitat dose instead of 0.000 rad/h
- reliability part titles no longer carry raw colour markup
- Ship Systems no longer shows limiting factors or a status once the craft is gone
- Ship Systems opens large enough to show its supplies without cutting off their values
- the experiment progress row has a render scene and the Uplink page is current

