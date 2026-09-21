Elects [RealAntennas](https://github.com/KSP-RO/RealAntennas) as the comms backend
whenever it is installed, so the comms readouts carry the RF link's own geometry
rather than a stock signal bar: band and tech level, the negotiated modulation and
coding, the data rate each way, and a link margin re-derived from the budget. It
also aims the craft's steerable antennas, either at one target or down a fallback
chain that walks itself while the craft has no link and holds still once it does.
