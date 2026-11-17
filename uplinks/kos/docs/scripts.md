# Running kOS scripts from Gonogo

The kOS Script Trigger and the kOS Terminal's `/` composer both run a script that is already on a kOS volume. Gonogo ships no kerboscript of its own, and nothing is typed into the CPU: Gonogo asks the game to start the script, the same way kOS starts a boot script.

## Running a script

Give the script's path as kOS reads it:

- `0:/launch.ks` runs it from the Archive. The craft needs a link home, the same as for kOS itself
- `1:/launch.ks` runs it from the CPU's own drive
- `launch.ks` runs it from the CPU's current volume

Arguments are separated by spaces. A number reaches the script as a number, `true` or `false` as a boolean, and anything else as a string. They arrive as the script's `PARAMETER`s, in order:

```
PARAMETER targetAltitude, verbose.
```

The CPU's screen shows `[gonogo] run 0:/launch.ks 80000 true` where a typed command would have been, then the script's own output and `Program ended.`.

In the terminal, Copy local & run (Ctrl+L) copies the script onto the CPU's own drive first and runs the copy. It is refused when the drive has no room for the script, or when the script is on the Archive and the craft has no link home.

## Handing values back

A script hands values back to the Script Trigger with `ADDONS:GONOGO:RETURN`. A lexicon gives one row per key:

```
PARAMETER a, b.
LOCAL total IS a + b.
ADDONS:GONOGO:RETURN(LEXICON("sum", total, "ok", TRUE, "craft", SHIP:NAME)).
```

The Script Trigger shows each key with its value as soon as the call is made. Any other value shows as one row named `value`. A number, a boolean or a string shows as itself. A list, a unique set, a queue, a stack, a nested lexicon, a vector, a direction, a timespan, a timestamp, a geoposition, a part and a vessel keep their structure, and anything else shows as the text kOS prints for it. A collection keeps its first 500 items, and nesting deeper than eight levels shows as text.

The run ends at the first `RETURN`. A script can keep running after it, but the Script Trigger has already shown its result, and a second run on that CPU is refused until the program finishes.

`ADDONS:GONOGO:RETURN` called from a script nobody started from a dashboard does nothing, so the same script can be run by hand at the terminal. `ADDONS:HASADDON("GONOGO")` is true wherever the kOS Uplink is installed.

## What the Script Trigger shows

| It shows | Because |
|---|---|
| OK with the fields | The script called `ADDONS:GONOGO:RETURN` |
| OK, "No fields returned." | The program finished, or was stopped with Ctrl+C, without calling it |
| Script error, with kOS's message | kOS stopped the script on an error. A runtime error names the script and line, for example `(0:/launch.ks line 12)`; a syntax error carries kOS's own compile message |
| A refusal | Nothing ran: there is no script at that path, the CPU is busy with another program or has a half-typed line at its prompt, or the drive has no room |
