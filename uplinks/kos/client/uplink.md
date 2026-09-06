Puts a real [kOS](https://github.com/KSP-KOS/KOS) terminal on the dashboard. The
screen you get is the one kOS itself is drawing, streamed in process off the mod's
own screen buffer, so there is no telnet loopback to open and no proxy to run
beside the game. Install kOS and the Gonogo mod, put a kOS CPU on the vessel, and
the Uplink discovers it.

## widget:kos-script-trigger

Dispatches a kerboscript to a chosen CPU and shows what came back. Each CPU's runs
are serialised behind one queue, because a run holds that CPU's REPL for the whole
of its execution, so a second dispatch waits rather than interleaving.
