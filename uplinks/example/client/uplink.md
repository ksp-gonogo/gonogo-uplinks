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

## widget:example-pulse-dial

The same channel as Heartbeat, drawn as an instrument instead of a readout. Two
widgets on one Topic is the ordinary case, not a special one: a Topic is not owned
by a widget, and nothing had to be duplicated to let both read it.

The decision worth copying is the one about the dial's range. `ticks` counts up
from load and never comes back, so there is no honest maximum to give a dial:
whatever number you pick, the needle pins there and stays, and a pinned needle
reads as "at the limit" when the truth is "past a number somebody guessed". So the
needle shows position in a sixty-publish cycle and the centre carries the real
total. An instrument is a claim about a quantity, and the widget's job is to pick a
presentation whose claim is true.

## augment:example-cadence-section

An augment renders a COMPONENT of yours inside a widget somebody else owns, which
is what you want whenever the thing you are showing belongs beside data another
widget already draws.

Two details do most of the work. `requires` gates the mount on
`example.available`, so an install without this Uplink's mod half renders the host
widget exactly as it was: no empty section, no "not installed" row, nothing. And
the component returns `null` rather than an empty state when it has no sample: a
widget owns its tile and can afford to explain itself, while an augment is a guest
in a layout somebody else designed, and a permanent "waiting" row inside another
panel is a line the operator learns to read past.

Note what the picture above says about itself. The real host widget ships with the
app, and an Uplink may not import it, so the harness mounts the section in a
stand-in panel and captions it as one. The section's own layout is faithful; how
it sits under the host's own rows is not something an Uplink author can
photograph.

## contribution:example:heartbeat-blob

A contribution hands DATA to another widget's renderer, with no component of your
own. The host draws it in the host's own visual language, so several contributors
land in one coherent picture instead of each drawing its own idea of a marker.
Reach for one whenever the host already draws a KIND of thing and you have another
of them; reach for an augment instead when you want to own how it looks.

`compute` is pure, and that is a requirement rather than a convention: it runs
during the host's render and re-runs when its inputs change, so a side effect here
fires at a cadence nobody chose. Being pure also makes it the cheapest thing in the
package to test, which is why it is exported and tested directly rather than
through a render.

**Why there is no picture.** A contribution is drawn by the widget that owns the
slot, and that widget ships with the app rather than in any published package. So
an Uplink author can register a contribution, typecheck it against the slot's real
entry type and unit-test its arithmetic, but cannot photograph the result: the
harness mounts a stand-in host, and a stand-in cannot draw entities it has no
renderer for. Listing it here without a preview is the honest form. A picture taken
from a stand-in that drew its own version of the mark would be a picture of
something the app does not do.

One rough edge to expect. The `topics` bag handed to `compute` types the slot's own
declared topics precisely, and everything else, your own Topics included, arrives
through an `unknown` tail and needs a cast. The cast is the only unchecked step in
that file, so keep it next to the type it asserts.
