# Changelog

## 1.0.0-rc.4 (2026-10-27)

### Breaking changes

- fixtures stop naming carried channels, and the SCANsat contract reads DYNAMIC_WHOLE_TOPIC_PREFIXES
- kerbcast's aim and sidecar members gate availability, fixture consistency reads career.facilities in its one shape, and the kos parser's contract is named for what it does
- a figure that stopped arriving is held, and a tooling scan keeps the other phrasing out
- build against contract 19, where refusals are string ids and a fault is thrown, not returned
- Program Detail carries the running Program's paid of total, deadline, overrun cost and READY TO COMPLETE, and ProgramStatus, which augmented Programme Funding, is gone
- build against contract 20.1, where IUplinkHost has no SetAuthorityDelay
- a value that stopped updating is held, on the sdk where Staleness.HeldStale is Staleness.Held
- every command handle reaches its panel's delay rail through useCommand, so no widget calls usePanelDelay
- every widget speaks the kit's one tone scale and Button family
- build every Uplink against gonogo contract 25, with the reference set, sdk, ui-kit and uplink-tools pinned to 3061994f9

### Features

- the RP-1 career Uplink arrives from gonogo
- rename _scene.host to _scene.hostWidget and refresh the vendored reference set
- publish what a head costs, so the hire control can quote a count and a price
- every declared client URL names its version directory on the releases branch, and the stale scansat bundle leaves the main tree
- refusals say RP-1 is not managing the save, its space centre is not loaded, or the build is not one the Uplink recognises
- rp1.budget carries RP-1's own net and every Budget tab row at a day, a month and a year, with subsidy, decay, Unlock Credit and a five-year forecast
- Vehicle Assembly draws the unlock credit from rp1.budget rather than career.status
- rp1.budgetBreakdown carries the lines under the Budget tab at a day, a month and a year: each building and launch complex's upkeep, each crew member's pay, each running course's cost, each Program's funding, the base pay a hire adds and every catalogue training's fee per student
- Admin Building gains a Finances screen drawing RP-1's net at a day, a month and a year, its eleven Budget rows with their lines, the subsidy with its floor and cap, reputation decay, Unlock Credit and the five-year forecast
- the Programs screen draws its own Accept, so Admin Building draws no Activate or Deactivate on its cards
- KSC Construction sets a construction's work rate and cancels it, with the draw per day and finish date at every rate beside the stepper and the funds spent beside Cancel; Facility Upgrades shows each tier's draw per day and finish date beside Queue
- rp1.program.complete completes a running Program as RP-1's Administration dialog does, Program Detail gains a Complete control with the reputation it earns, and core's career.strategy.deactivate is refused for a Program because it strands one
- rp1.strategy.activate splits into rp1.program.accept, which takes the speed and prices Confidence at it, and rp1.leader.appoint; Program Detail's Accept offers each speed with its Confidence price, term and average funding per day and sends the one picked
- Astronaut Complex shows Salary per Naut, what each hire adds to upkeep per day, and Start a Training shows what the picked course adds per day for the students picked
- Finances shows a total upkeep row, the leaders-and-strategies modifiers line and the Astronauts subtotals, and keeps the last budget up marked held when the link drops
- rp1.personnel.hire and rp1.personnel.fire hire and fire engineers at the active centre or researchers by a count, as RP-1's Staffing window does; KSC Complexes offers them beside the hire target with the one-off cost against the balance and the salary per day each adds or saves
- Research Queue sets the research work rate, with what researchers are paid, the Unlock Credit earned and the node's finish date at the chosen rate beside the stepper, and how pay and credit change from the rate now
- rp1.leaders publishes every leader with RP-1's appointment verdict and a serving leader's dismissal cost, rp1.leader.appoint refuses a locked, cooling-down or disabled leader, and a Leaders screen offers Appoint at no cost and Dismiss with the reputation and subsidy it costs
- Finances shows RP-1's Career Log ledger, each month's Program funds, net maintenance and closing funds newest first and every line RP-1 booked a press away, from a new rp1.careerLedger topic
- RP-1 owns its simulation: a delayInSimulation setting, the zero delay modifier held only while it is off, an rp1.simulation topic and a SIMULATION header badge
- the funds alarm moves into Finances with RP-1's own EstimateTimeToFunds forecast, published per figure under rp1.fundsReachedAt.<funds>
- whether crew retire is read from RP-1's mod settings on settings.rp1, and leaves the rp1.crewProgram payload
- rp1.tech.research, launch and leader activation answer per item before the press, so a dark control carries the refusal the press would return
- a course on RP-1 4.7's training queue reads QUEUED and offers no per-student Remove, from a queued flag on rp1.training
- Finances Facilities drill heads each space centre once above its complexes instead of suffixing every row
- every Uplink's topics loop passes its generated statics and enum tables to registerTopicUnits and registerTypeUnits and registers GENERATED_ENUM_MEMBERS, so Uplink enum fields reach the note tag picker
- missionTrainingEnabled is read from RP-1's mod settings on settings.rp1 through modSettingDep, and leaves the rp1.crewProgram payload
- rp1.budgetBreakdown carries a line per rollout, per construction and per integration team, each priced as RP-1 prices it and summing to its Budget row
- Finances opens the Integration Teams, Rollout / Airlaunch Prep and Constructions rows onto a line per complex team, operation and construction
- enrolling a kerbal on leave queues the training on RP-1 4.7 and starts when they are back
- a saved craft says RP-1 prices its build when started, and the empty cost field is gone
- a saved craft shows RP-1's real build price beside Start build and if funds cover it
- an alarm follows the next project to finish, replacing the warp to complete command

### Fixes

- regenerate realfuels, scansat and rp1 for the null-widened reference members, and type rp1's consumers for the null
- regenerate every Uplink's topic map for the collection Topic list, and kerbcast's contract for the null-widened reference members
- every uplink.json client URL and the tag-resolver hint name uplinks/releases/<id>/<version>/, and a test catches the flat layout regressing
- the fund-target alarm arms at the active command centre, not the craft's clock
- the crew augments type against the Astronaut Complex's published slots, and the duplicate simulation-delay row goes
- nothing reads or names vessel.state, and the plottability probe stops claiming a derived reckoning
- the Astronaut Complex's crew figures say when they are held
- the new-complex centre switch takes one name, its visible label
- training enrolment matches RP-1 4.7's MeetsStudentReqs(pcm, allowInactive) and keeps 4.6's, rp1.training and rp1.crew read 4.7's queued courses, and builtAgainst moves to 4.7.0.0
- the Program catalogue's filter sits above the list it narrows, through FilterRegion
- every delayed command declares the Subject topic it acts on
- rp1.budgetBreakdown names what RP-1's tabs name: each Program carries its title and Nominal Deadline, each complex its centre's display name, and Finances shows them
- rp1.build.start opens its craft through core's restored ICraftCatalogue
- a retiree keeps stock's Dead standing with the reason Retired, and the Astronaut Complex marks them RETIRED with their retirement date
- rp1.build.start refuses a craft whose own part modules report a locked or broken configuration, walking them the way RP-1's validator does
- rp1.build.start puts back the editor start-up RealFuels tanks, ProceduralParts and ProceduralFairings need before their configuration checks, so a craft loaded at the Space Center gets the verdict RP-1's integrate button gives it
- restore the other Uplinks' pages, which their own pinned tools still write
- the app can now load the client of each of these Uplinks
- list-only Topics in eight Uplinks show their item units instead of a dash
- the crew enrolment page scene shows refused kerbals the way RP-1 4.7 refuses them
- the launch complex list no longer goes dark once a new complex is being built
- RP-1 screens follow the Administration Building and Research and Development renames
- Uplinks read planets and moons from the Tracking Station, as Gonogo sends them
- the funding curve draws with the Graph the current kit publishes
- the funding curve draws with the Graph the current kit publishes
- each Gonogo add-on mod reports the version it was released as
- camera feed and libration points input actions use kebab-case ids

