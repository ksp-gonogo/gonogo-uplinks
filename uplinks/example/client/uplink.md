The smallest Uplink that is still a real one: one KSP plugin, one channel, one
widget, and no third-party mod to install. Copy this directory to start your own.

Its whole job is to publish a heartbeat, so every piece of the machinery has
something to carry: a payload declared in C# with a unit on each field, the
codegen that turns that declaration into TypeScript, a widget that reads the
channel, a fixture that renders the widget, and a release that publishes a
bundle the app can load. Nothing here is a placeholder, so if it builds and the
CI legs are green, the layout works.

## This file

Everything else on the page beside this text is DERIVED: the widget list, the
channels, the units, the compat numbers and the screenshots all come out of your
registrations, your contract slice and your fixtures. `uplink.md` is the one file
you write, and `gonogo-uplink docs` assembles the page from it.

Put a lede here (what the Uplink is for, which mod it integrates, what someone
has to install first) and, where a widget needs more than its own one-line
description, a `## widget:<id>` section. The generator refuses a section naming an
id nothing registered, so prose about a widget you deleted fails the build rather
than quietly disappearing.

Then run `npm run docs` in this directory and commit what it writes. CI checks
that the committed page still matches the code, and the workflow on `main`
regenerates it for you when something else changes it.

## Install

Nothing. This Uplink wraps no mod, so it loads and publishes on any install with
GonogoCore. That is the point of it as a starting point: the first thing you
change should be the payload, not the plumbing.

## widget:example-heartbeat

Publishes a tick count and the universal time of the last sample, which is enough
to see whether the Uplink is alive and whether the wire is moving.

The `ut` field is declared as a universal time rather than a duration, and that
distinction is worth copying rather than glossing over. An instant and an interval
are different units, the client renders them differently, and a Countdown handed a
UT refuses it rather than showing a wrong number.
