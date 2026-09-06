Puts a full-fidelity aerodynamic model's own numbers on the flight board rather
than the stock drag approximation: angle of attack, sideslip, stall fraction,
lift, drag and dynamic pressure, as
[Ferram Aerospace Research](https://github.com/dkavolis/Ferram-Aerospace-Research)
computes them. FAR has to be installed in the same KSP; without it the Uplink
reports itself unavailable and the widget says so instead of drawing zeros.

Nothing here links or derives from FAR. Every member is reached by runtime
reflection, read against FAR v0.16.1.2, which is what keeps this Uplink MIT while
the mod it reads is not.

Two contributions ride alongside the widget: a descent-corridor plot layer on the
landing view, and stall and alpha badges on the landing-status panel.
