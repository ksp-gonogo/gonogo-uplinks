Puts a full-fidelity aerodynamic model's own numbers on the flight board rather
than the stock drag approximation: angle of attack, sideslip, stall fraction,
lift, drag and dynamic pressure, as
[Ferram Aerospace Research](https://github.com/dkavolis/Ferram-Aerospace-Research)
computes them. FAR has to be installed in the same KSP; without it the Uplink
reports itself unavailable and its contributions draw nothing rather than
zeros.

Nothing here links or derives from FAR. Every member is reached by runtime
reflection, read against FAR v0.16.1.2, which is what keeps this Uplink MIT while
the mod it reads is not.

This Uplink has no tile of its own; everything it draws rides into
`landing-status` as a contribution: a descent-corridor plot layer on the
landing view, an attitude-to-airflow plot placing angle of attack against
sideslip, and stall and alpha badges on the panel.
