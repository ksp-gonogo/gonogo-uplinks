Answers the question an [RP-1](https://github.com/KSP-RO/RP-0) launch turns on: is
the vessel within the active avionics unit's controllable-mass limit. RP-1 locks
the controls the moment vessel mass exceeds that limit, so this is a pre-launch
go/no-go rather than a gauge to watch during ascent.

RP-1 has to be installed for anything to appear. The mod half reaches RP-1 purely
by reflection and never links RP0.dll, so an install without it simply reports no
avionics rather than failing to load.
