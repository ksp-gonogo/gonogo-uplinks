# Changelog

## 1.0.0-rc.8 (2026-10-30)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- kerbcast's aim and sidecar members gate availability, fixture consistency reads career.facilities in its one shape, and the kos parser's contract is named for what it does
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- the docking camera tells Targeting its picture's aspect, so the reticle's degree scale follows the camera's own field
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- let a bound stick turn the staged setpoint wheel
- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- the slot pool starts at 32, so a crew bar no longer consumes it before the camera widget
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the main-render throttle moves to a Kerbcast settings tab, since the plugin owns it and the source-backed row it used is gone
- Camera Feed carries its resting name as the panel title, on the kit whose header row never grows when a badge arrives
- Kerbalism lists and reads its reliability settings, and Kerbcast's main-render throttle is a writable mod setting in place of its custom settings tab
- a station brokers the camera handshake through the station broker kerbcast registers, since the station no longer names kerbcast
- CameraFeed drops its signal delay badge now the dashboard header carries the delay
- CameraFeed's frame takes the aspect of the stream it is playing, read off the video's own dimensions, and falls back to the camera's configured size until a frame arrives
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- camera feeds record why a camera was refused and bind a late camera once it appears
- camera feeds can be watched from other devices, offered in the first-run setup
- Crew Status shows the kerbal's initial where the face camera is unavailable
- delayed camera feeds can log their frame totals when a storage flag is set
- destroyed cameras fold into one signal lost menu in the camera feed header
- Settings says whether other computers can reach the camera feeds
- camera feed brackets turn orange or blue when a target position is old or estimated
- camera feeds reach stations on other networks through Gonogo's relay port
- command cameras show only what their site's command centre knows while delay is on
- command cameras find craft the game has lost and clear gonogo's hold with delay off
- camera aim and zoom commands are delayed by the signal to the camera's own craft
- the camera feed asks for fast flight data while Faster data rate is on
- every Uplink builds on contract 50, and camera feeds work with Kerbcast 1.12.0-rc.2
- a command camera aims at where the home command predicts a craft is
- a launch-site camera is bound to the ground station nearest the launch site
- a ground camera follows the active craft while the command centre has heard from it
- a launch-site camera logs its launch site's source and the station it was given

### Fixes

- repoint at the current packs, and reach zero under nodenext
- give the camera feed a panel and frame its video
- stop the aim controls covering the shot they are aiming
- put the camera feed under Panel and cut its aim controls to corner chrome
- shrink the camera aim cluster and stop the tile reshaping the shot
- stop eight Uplinks stating readings nobody took
- give the staged camera cluster the corner, the preview and one control
- turn the pitch wheel instead of thinning it, and draw the commit in the cluster's own voice
- stand the framing preview at the foot of the picture, out of the cluster that was slicing it
- stop naming the camera twice and give the picture the header's room
- say when a camera has no video because every slot in the pool is bound
- stop an unresolved method reporting itself as a camera the vessel does not have
- regenerate every committed slice against the current gonogo contract
- drop the CommandDeclaration.Delayed restatement the contract no longer has
- vendor the sdk and ui-kit that give a doc film its own clock, so the stick-hold renders the same twice
- regenerate every client contract for the null the wire sends
- a refused camera fails like any other error, not a tracked state
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the setpoint cluster takes the kit's regular box radius
- the camera feed's delay badge marks a held delay
- declare the CKAN distribution instead of manual
- every delayed command declares the Subject topic it acts on
- the staged aim cluster draws yaw and pitch only for a camera that pans and the FOV tape only for one that zooms
- the setpoint wheels pass label={false}, since the kit's JogWheel now draws a caption of its ariaLabel above each wheel
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- a camera whose delay pipeline cannot be built shows unavailable, not connecting
- the docking camera follows the Targeting widget's rename to Rendezvous
- the camera feed's signal badge moves to the panel header, off the picture
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- the camera feed says when KSP cannot be reached for video
- each Gonogo add-on mod reports the version it was released as
- outside a flight the Kerbcast Uplink reads idle, not degraded
- camera feeds no longer freeze after a dropped frame
- camera feed and libration points input actions use kebab-case ids
- the camera picker lists live cameras by craft and keeps lost ones out of the way
- the camera feed stays 16:9 in a narrow phone tile and stops shrinking its own stream
- the camera feed's size report names the Topics it reads, none
- camera feeds on stations over the internet no longer run out of connection capacity
- stations open only as many camera channels as their screen shows
- stations open only as many camera channels as their screen shows
- a browser with no H.264 decoder says it cannot play the camera video
- a Camera Feed in fullscreen asks for a stream sized to the screen
- a browser with no H.264 decoder says it cannot play the camera video
- camera feeds with static on run at the camera's frame rate under signal delay
- delayed camera video is dated from each frame's own capture stamp
- the Uplink is built against the Kerbcast release its client depends on
- the Camera Feed header no longer shows a signal reading when there is no camera feed
- the Uplink is built against Kerbcast 1.11.0
- the root README names the Kerbcast release the Uplink wraps
- the Uplink's npm lockfile and CKAN dependency name Kerbcast 1.11.0
- camera pan and zoom no longer move instantly under a short signal delay
- opening another camera feed no longer drops every feed already on screen
- the Uplink is built against Kerbcast 1.12.0-rc.1
- a camera tile says NO CAMERA or FEED STALLED where it showed the same static for both
- switching camera no longer leaves the previous camera's last frame on screen
- a camera that leaves the list frees its video slot, so relaunches do not run out
- a camera feed follows its camera to the new one after the craft is relaunched
- delayed video keeps its frame stamps after a connection drop that recovers
- a delayed feed flushes its held frames when the camera restarts on the same id
- a delayed feed builds its video transform at the moment the camera asks for it
- a delayed feed that stays empty after a relaunch is retried for as long as its delay holds frames
- a delayed feed's retry window covers the frames its pacing buffer holds
- a craft that undocks and docks again keeps command cameras working
- command cameras keep their hold when another mod has reserved Kerbcast first
- the workspace lockfile names Kerbcast 1.12.0-rc.2
- a command camera aims at the place its site's centre last heard, saw or modelled a craft
- a detached feed is held for the delay plus the pipeline's own lead limit
- a camera feed no longer restarts its own new picture when it first opens
- a camera feed no longer restarts its picture when the camera clock first reports
- with signal delay off a camera no longer starts locked for gonogo from an earlier run
- a launch-site camera finds its launch site from the place the game builds it on
- a launch-site camera finds its launch site among the game's sites and facilities

## 1.0.0-rc.7 (2026-10-30)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- kerbcast's aim and sidecar members gate availability, fixture consistency reads career.facilities in its one shape, and the kos parser's contract is named for what it does
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- the docking camera tells Targeting its picture's aspect, so the reticle's degree scale follows the camera's own field
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- let a bound stick turn the staged setpoint wheel
- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- the slot pool starts at 32, so a crew bar no longer consumes it before the camera widget
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the main-render throttle moves to a Kerbcast settings tab, since the plugin owns it and the source-backed row it used is gone
- Camera Feed carries its resting name as the panel title, on the kit whose header row never grows when a badge arrives
- Kerbalism lists and reads its reliability settings, and Kerbcast's main-render throttle is a writable mod setting in place of its custom settings tab
- a station brokers the camera handshake through the station broker kerbcast registers, since the station no longer names kerbcast
- CameraFeed drops its signal delay badge now the dashboard header carries the delay
- CameraFeed's frame takes the aspect of the stream it is playing, read off the video's own dimensions, and falls back to the camera's configured size until a frame arrives
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- camera feeds record why a camera was refused and bind a late camera once it appears
- camera feeds can be watched from other devices, offered in the first-run setup
- Crew Status shows the kerbal's initial where the face camera is unavailable
- delayed camera feeds can log their frame totals when a storage flag is set
- destroyed cameras fold into one signal lost menu in the camera feed header
- Settings says whether other computers can reach the camera feeds
- camera feed brackets turn orange or blue when a target position is old or estimated
- camera feeds reach stations on other networks through Gonogo's relay port
- command cameras show only what their site's command centre knows while delay is on
- command cameras find craft the game has lost and clear gonogo's hold with delay off
- camera aim and zoom commands are delayed by the signal to the camera's own craft
- the camera feed asks for fast flight data while Faster data rate is on
- every Uplink builds on contract 50, and camera feeds work with Kerbcast 1.12.0-rc.2

### Fixes

- repoint at the current packs, and reach zero under nodenext
- give the camera feed a panel and frame its video
- stop the aim controls covering the shot they are aiming
- put the camera feed under Panel and cut its aim controls to corner chrome
- shrink the camera aim cluster and stop the tile reshaping the shot
- stop eight Uplinks stating readings nobody took
- give the staged camera cluster the corner, the preview and one control
- turn the pitch wheel instead of thinning it, and draw the commit in the cluster's own voice
- stand the framing preview at the foot of the picture, out of the cluster that was slicing it
- stop naming the camera twice and give the picture the header's room
- say when a camera has no video because every slot in the pool is bound
- stop an unresolved method reporting itself as a camera the vessel does not have
- regenerate every committed slice against the current gonogo contract
- drop the CommandDeclaration.Delayed restatement the contract no longer has
- vendor the sdk and ui-kit that give a doc film its own clock, so the stick-hold renders the same twice
- regenerate every client contract for the null the wire sends
- a refused camera fails like any other error, not a tracked state
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the setpoint cluster takes the kit's regular box radius
- the camera feed's delay badge marks a held delay
- declare the CKAN distribution instead of manual
- every delayed command declares the Subject topic it acts on
- the staged aim cluster draws yaw and pitch only for a camera that pans and the FOV tape only for one that zooms
- the setpoint wheels pass label={false}, since the kit's JogWheel now draws a caption of its ariaLabel above each wheel
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- a camera whose delay pipeline cannot be built shows unavailable, not connecting
- the docking camera follows the Targeting widget's rename to Rendezvous
- the camera feed's signal badge moves to the panel header, off the picture
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- the camera feed says when KSP cannot be reached for video
- each Gonogo add-on mod reports the version it was released as
- outside a flight the Kerbcast Uplink reads idle, not degraded
- camera feeds no longer freeze after a dropped frame
- camera feed and libration points input actions use kebab-case ids
- the camera picker lists live cameras by craft and keeps lost ones out of the way
- the camera feed stays 16:9 in a narrow phone tile and stops shrinking its own stream
- the camera feed's size report names the Topics it reads, none
- camera feeds on stations over the internet no longer run out of connection capacity
- stations open only as many camera channels as their screen shows
- stations open only as many camera channels as their screen shows
- a browser with no H.264 decoder says it cannot play the camera video
- a Camera Feed in fullscreen asks for a stream sized to the screen
- a browser with no H.264 decoder says it cannot play the camera video
- camera feeds with static on run at the camera's frame rate under signal delay
- delayed camera video is dated from each frame's own capture stamp
- the Uplink is built against the Kerbcast release its client depends on
- the Camera Feed header no longer shows a signal reading when there is no camera feed
- the Uplink is built against Kerbcast 1.11.0
- the root README names the Kerbcast release the Uplink wraps
- the Uplink's npm lockfile and CKAN dependency name Kerbcast 1.11.0
- camera pan and zoom no longer move instantly under a short signal delay
- opening another camera feed no longer drops every feed already on screen
- the Uplink is built against Kerbcast 1.12.0-rc.1
- a camera tile says NO CAMERA or FEED STALLED where it showed the same static for both
- switching camera no longer leaves the previous camera's last frame on screen
- a camera that leaves the list frees its video slot, so relaunches do not run out
- a camera feed follows its camera to the new one after the craft is relaunched
- delayed video keeps its frame stamps after a connection drop that recovers
- a delayed feed flushes its held frames when the camera restarts on the same id
- a delayed feed builds its video transform at the moment the camera asks for it
- a delayed feed that stays empty after a relaunch is retried for as long as its delay holds frames
- a delayed feed's retry window covers the frames its pacing buffer holds
- a craft that undocks and docks again keeps command cameras working
- command cameras keep their hold when another mod has reserved Kerbcast first
- the workspace lockfile names Kerbcast 1.12.0-rc.2
- a command camera aims at the place its site's centre last heard, saw or modelled a craft
- a detached feed is held for the delay plus the pipeline's own lead limit
- a camera feed no longer restarts its own new picture when it first opens
- a camera feed no longer restarts its picture when the camera clock first reports

## 1.0.0-rc.6 (2026-10-26)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- kerbcast's aim and sidecar members gate availability, fixture consistency reads career.facilities in its one shape, and the kos parser's contract is named for what it does
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- the docking camera tells Targeting its picture's aspect, so the reticle's degree scale follows the camera's own field
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- let a bound stick turn the staged setpoint wheel
- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- the slot pool starts at 32, so a crew bar no longer consumes it before the camera widget
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the main-render throttle moves to a Kerbcast settings tab, since the plugin owns it and the source-backed row it used is gone
- Camera Feed carries its resting name as the panel title, on the kit whose header row never grows when a badge arrives
- Kerbalism lists and reads its reliability settings, and Kerbcast's main-render throttle is a writable mod setting in place of its custom settings tab
- a station brokers the camera handshake through the station broker kerbcast registers, since the station no longer names kerbcast
- CameraFeed drops its signal delay badge now the dashboard header carries the delay
- CameraFeed's frame takes the aspect of the stream it is playing, read off the video's own dimensions, and falls back to the camera's configured size until a frame arrives
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- camera feeds record why a camera was refused and bind a late camera once it appears
- camera feeds can be watched from other devices, offered in the first-run setup
- Crew Status shows the kerbal's initial where the face camera is unavailable
- delayed camera feeds can log their frame totals when a storage flag is set
- destroyed cameras fold into one signal lost menu in the camera feed header
- Settings says whether other computers can reach the camera feeds
- camera feed brackets turn orange or blue when a target position is old or estimated
- camera feeds reach stations on other networks through Gonogo's relay port

### Fixes

- repoint at the current packs, and reach zero under nodenext
- give the camera feed a panel and frame its video
- stop the aim controls covering the shot they are aiming
- put the camera feed under Panel and cut its aim controls to corner chrome
- shrink the camera aim cluster and stop the tile reshaping the shot
- stop eight Uplinks stating readings nobody took
- give the staged camera cluster the corner, the preview and one control
- turn the pitch wheel instead of thinning it, and draw the commit in the cluster's own voice
- stand the framing preview at the foot of the picture, out of the cluster that was slicing it
- stop naming the camera twice and give the picture the header's room
- say when a camera has no video because every slot in the pool is bound
- stop an unresolved method reporting itself as a camera the vessel does not have
- regenerate every committed slice against the current gonogo contract
- drop the CommandDeclaration.Delayed restatement the contract no longer has
- vendor the sdk and ui-kit that give a doc film its own clock, so the stick-hold renders the same twice
- regenerate every client contract for the null the wire sends
- a refused camera fails like any other error, not a tracked state
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the setpoint cluster takes the kit's regular box radius
- the camera feed's delay badge marks a held delay
- declare the CKAN distribution instead of manual
- every delayed command declares the Subject topic it acts on
- the staged aim cluster draws yaw and pitch only for a camera that pans and the FOV tape only for one that zooms
- the setpoint wheels pass label={false}, since the kit's JogWheel now draws a caption of its ariaLabel above each wheel
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- a camera whose delay pipeline cannot be built shows unavailable, not connecting
- the docking camera follows the Targeting widget's rename to Rendezvous
- the camera feed's signal badge moves to the panel header, off the picture
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- the camera feed says when KSP cannot be reached for video
- each Gonogo add-on mod reports the version it was released as
- outside a flight the Kerbcast Uplink reads idle, not degraded
- camera feeds no longer freeze after a dropped frame
- camera feed and libration points input actions use kebab-case ids
- the camera picker lists live cameras by craft and keeps lost ones out of the way
- the camera feed stays 16:9 in a narrow phone tile and stops shrinking its own stream
- the camera feed's size report names the Topics it reads, none
- camera feeds on stations over the internet no longer run out of connection capacity
- stations open only as many camera channels as their screen shows
- stations open only as many camera channels as their screen shows
- a browser with no H.264 decoder says it cannot play the camera video
- a Camera Feed in fullscreen asks for a stream sized to the screen
- a browser with no H.264 decoder says it cannot play the camera video
- camera feeds with static on run at the camera's frame rate under signal delay
- delayed camera video is dated from each frame's own capture stamp
- the Uplink is built against the Kerbcast release its client depends on
- the Camera Feed header no longer shows a signal reading when there is no camera feed
- the Uplink is built against Kerbcast 1.11.0
- the root README names the Kerbcast release the Uplink wraps
- the Uplink's npm lockfile and CKAN dependency name Kerbcast 1.11.0

## 1.0.0-rc.5 (2026-10-26)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- kerbcast's aim and sidecar members gate availability, fixture consistency reads career.facilities in its one shape, and the kos parser's contract is named for what it does
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- the docking camera tells Targeting its picture's aspect, so the reticle's degree scale follows the camera's own field
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- let a bound stick turn the staged setpoint wheel
- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- the slot pool starts at 32, so a crew bar no longer consumes it before the camera widget
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- the main-render throttle moves to a Kerbcast settings tab, since the plugin owns it and the source-backed row it used is gone
- Camera Feed carries its resting name as the panel title, on the kit whose header row never grows when a badge arrives
- Kerbalism lists and reads its reliability settings, and Kerbcast's main-render throttle is a writable mod setting in place of its custom settings tab
- a station brokers the camera handshake through the station broker kerbcast registers, since the station no longer names kerbcast
- CameraFeed drops its signal delay badge now the dashboard header carries the delay
- CameraFeed's frame takes the aspect of the stream it is playing, read off the video's own dimensions, and falls back to the camera's configured size until a frame arrives
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- camera feeds record why a camera was refused and bind a late camera once it appears
- camera feeds can be watched from other devices, offered in the first-run setup
- Crew Status shows the kerbal's initial where the face camera is unavailable
- delayed camera feeds can log their frame totals when a storage flag is set
- destroyed cameras fold into one signal lost menu in the camera feed header
- Settings says whether other computers can reach the camera feeds
- camera feed brackets turn orange or blue when a target position is old or estimated
- camera feeds reach stations on other networks through Gonogo's relay port

### Fixes

- repoint at the current packs, and reach zero under nodenext
- give the camera feed a panel and frame its video
- stop the aim controls covering the shot they are aiming
- put the camera feed under Panel and cut its aim controls to corner chrome
- shrink the camera aim cluster and stop the tile reshaping the shot
- stop eight Uplinks stating readings nobody took
- give the staged camera cluster the corner, the preview and one control
- turn the pitch wheel instead of thinning it, and draw the commit in the cluster's own voice
- stand the framing preview at the foot of the picture, out of the cluster that was slicing it
- stop naming the camera twice and give the picture the header's room
- say when a camera has no video because every slot in the pool is bound
- stop an unresolved method reporting itself as a camera the vessel does not have
- regenerate every committed slice against the current gonogo contract
- drop the CommandDeclaration.Delayed restatement the contract no longer has
- vendor the sdk and ui-kit that give a doc film its own clock, so the stick-hold renders the same twice
- regenerate every client contract for the null the wire sends
- a refused camera fails like any other error, not a tracked state
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the setpoint cluster takes the kit's regular box radius
- the camera feed's delay badge marks a held delay
- declare the CKAN distribution instead of manual
- every delayed command declares the Subject topic it acts on
- the staged aim cluster draws yaw and pitch only for a camera that pans and the FOV tape only for one that zooms
- the setpoint wheels pass label={false}, since the kit's JogWheel now draws a caption of its ariaLabel above each wheel
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of kOS, MechJeb, Principia, RealFuels, FAR, Kerbcast and RealAntennas
- a camera whose delay pipeline cannot be built shows unavailable, not connecting
- the docking camera follows the Targeting widget's rename to Rendezvous
- the camera feed's signal badge moves to the panel header, off the picture
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- the camera feed says when KSP cannot be reached for video
- each Gonogo add-on mod reports the version it was released as
- outside a flight the Kerbcast Uplink reads idle, not degraded
- camera feeds no longer freeze after a dropped frame
- camera feed and libration points input actions use kebab-case ids
- the camera picker lists live cameras by craft and keeps lost ones out of the way
- the camera feed stays 16:9 in a narrow phone tile and stops shrinking its own stream
- the camera feed's size report names the Topics it reads, none
- camera feeds on stations over the internet no longer run out of connection capacity
- stations open only as many camera channels as their screen shows
- stations open only as many camera channels as their screen shows
- a browser with no H.264 decoder says it cannot play the camera video
- a Camera Feed in fullscreen asks for a stream sized to the screen
- a browser with no H.264 decoder says it cannot play the camera video
- camera feeds with static on run at the camera's frame rate under signal delay
- delayed camera video is dated from each frame's own capture stamp
- the Uplink is built against the Kerbcast release its client depends on
- the Camera Feed header no longer shows a signal reading when there is no camera feed
- the Uplink is built against Kerbcast 1.11.0
- the root README names the Kerbcast release the Uplink wraps
- the Uplink's npm lockfile and CKAN dependency name Kerbcast 1.11.0

