# Changelog

## 1.0.0-rc.5 (2026-10-30)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- an antenna chain's walk phase is walkPhase, reachable as a field reading instead of shadowed by the reading's state
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the RealAntennas comms-backend Uplink arrives from gonogo
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the Kerbalism, SCANsat and RealAntennas rig tools move out of gonogo core into each Uplink's mod-devtools, built in CI and never packaged
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- the contact plan sees where each dish points, so a pair is in contact only while some compatible antenna pairing has each end inside the other's beam and within its link budget's reach
- the backend states what a link is worth at a separation, by RealAntennas' own rate ladder from both ends' antennas, and that a path is worth its weakest link, so a command centre is shown the strength and the hop facts of the path it believes in
- turn an idle dish to carry a held message, and restore it after
- a command centre keeps RealAntennas' hop facts across a load
- link quality is now reported together with link margin
- the log lists each chain's signal and link decision, even when unloaded
- a relay hop reports which direction it carries
- CommNet Signal shows a data rate from RealAntennas, or Kerbalism's with its target
- every Uplink builds on contract 50, and camera feeds work with Kerbcast 1.12.0-rc.2

### Fixes

- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the comms backend answers any vessel's control path, not only the scoped craft's
- every delayed command declares the Subject topic it acts on
- comms.linkMargin, comms.linkQuality, comms.dataRate and realantennas.hopRates are Delayed, so a command centre learns the far end's link one light-time after it was so
- the home command centre is found on a game resumed straight into a flight far from the space centre, from where the scenery is placed, where the first ground station by name stood in for it until the space centre had been visited
- a pair reaches as far as the slowest symbol rate both antennas can run still closes, as RealAntennas keeps a link by stepping its rate down, where the reach was reckoned at the fastest rate and a link the game still carried was planned as long out of range
- a fallback chain gives a target at least twice the time a link was measured to take to show at the current warp rate before judging it, where the fixed thirty game seconds ran out before the link could appear at 1000x and the chain spun through its list
- a chain held on an unloaded craft says what is known, that a new aim would be saved with the craft and that whether its link would follow before it loads has not been established, where it said the aim would change a copy the game throws away
- a fallback chain is kept under its antenna's part, read off the part or its saved snapshot, so a craft that unloads still shows its chain and where its walk had got to, and a chain follows its part through a dock; a chain an older save holds under its command address is taken up the first time its antenna is seen
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- list-only Topics in eight Uplinks show their item units instead of a dash
- antenna target chains on unloaded craft now continue to the next target
- the link margin now follows where a dish is aimed and never reads negative
- link margin never reads below zero while up, and health says if aim is ignored
- RealAntennas loads again, and its dish target picker lists every craft
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- a held antenna retarget chain now logs why it is holding
- a route no longer passes through a dish that cannot see its relay
- a link plan reaches only as far as the lower-level encoder of the two ends allows
- a link plan prices pointing loss and sky noise exactly as RealAntennas does
- a link plan adds the noise of bodies in a dish's beam and a station's atmosphere
- a craft's receiver noise is the tech level's, as RealAntennas takes it
- the dish-turning plan counts the noise of bodies in the beam it would aim
- after a load, a quiet craft is no longer planned to reach dishes facing away
- each Gonogo add-on mod reports the version it was released as
- a craft with no electric charge reaches nowhere, and its plan says unpowered
- the link budget reads the antenna on the craft's end of the route
- an antenna's power draw is reported in electric charge a second, not milliwatts
- the link budget is blank while the signal is lost
- the link budget names the band and says modulation is bits per symbol
- the link budget reads the antenna on the craft's end of the route
- an antenna's power draw is reported in electric charge a second, not milliwatts
- the link budget is blank while the signal is lost
- the link budget names the band and says modulation is bits per symbol

## 1.0.0-rc.4 (2026-10-27)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- an antenna chain's walk phase is walkPhase, reachable as a field reading instead of shadowed by the reading's state
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the RealAntennas comms-backend Uplink arrives from gonogo
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the Kerbalism, SCANsat and RealAntennas rig tools move out of gonogo core into each Uplink's mod-devtools, built in CI and never packaged
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- the contact plan sees where each dish points, so a pair is in contact only while some compatible antenna pairing has each end inside the other's beam and within its link budget's reach
- the backend states what a link is worth at a separation, by RealAntennas' own rate ladder from both ends' antennas, and that a path is worth its weakest link, so a command centre is shown the strength and the hop facts of the path it believes in
- turn an idle dish to carry a held message, and restore it after
- a command centre keeps RealAntennas' hop facts across a load
- link quality is now reported together with link margin
- the log lists each chain's signal and link decision, even when unloaded
- a relay hop reports which direction it carries

### Fixes

- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the comms backend answers any vessel's control path, not only the scoped craft's
- every delayed command declares the Subject topic it acts on
- comms.linkMargin, comms.linkQuality, comms.dataRate and realantennas.hopRates are Delayed, so a command centre learns the far end's link one light-time after it was so
- the home command centre is found on a game resumed straight into a flight far from the space centre, from where the scenery is placed, where the first ground station by name stood in for it until the space centre had been visited
- a pair reaches as far as the slowest symbol rate both antennas can run still closes, as RealAntennas keeps a link by stepping its rate down, where the reach was reckoned at the fastest rate and a link the game still carried was planned as long out of range
- a fallback chain gives a target at least twice the time a link was measured to take to show at the current warp rate before judging it, where the fixed thirty game seconds ran out before the link could appear at 1000x and the chain spun through its list
- a chain held on an unloaded craft says what is known, that a new aim would be saved with the craft and that whether its link would follow before it loads has not been established, where it said the aim would change a copy the game throws away
- a fallback chain is kept under its antenna's part, read off the part or its saved snapshot, so a craft that unloads still shows its chain and where its walk had got to, and a chain follows its part through a dock; a chain an older save holds under its command address is taken up the first time its antenna is seen
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- list-only Topics in eight Uplinks show their item units instead of a dash
- antenna target chains on unloaded craft now continue to the next target
- the link margin now follows where a dish is aimed and never reads negative
- link margin never reads below zero while up, and health says if aim is ignored
- RealAntennas loads again, and its dish target picker lists every craft
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- a held antenna retarget chain now logs why it is holding
- a route no longer passes through a dish that cannot see its relay
- a link plan reaches only as far as the lower-level encoder of the two ends allows
- a link plan prices pointing loss and sky noise exactly as RealAntennas does
- a link plan adds the noise of bodies in a dish's beam and a station's atmosphere
- a craft's receiver noise is the tech level's, as RealAntennas takes it
- the dish-turning plan counts the noise of bodies in the beam it would aim
- after a load, a quiet craft is no longer planned to reach dishes facing away
- each Gonogo add-on mod reports the version it was released as
- a craft with no electric charge reaches nowhere, and its plan says unpowered
- the link budget reads the antenna on the craft's end of the route
- an antenna's power draw is reported in electric charge a second, not milliwatts
- the link budget is blank while the signal is lost
- the link budget names the band and says modulation is bits per symbol
- the link budget reads the antenna on the craft's end of the route
- an antenna's power draw is reported in electric charge a second, not milliwatts
- the link budget is blank while the signal is lost
- the link budget names the band and says modulation is bits per symbol

