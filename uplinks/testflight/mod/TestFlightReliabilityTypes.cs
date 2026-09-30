namespace GonogoTestFlightUplink
{
    /// <summary>
    /// The values <c>TestFlightReliabilitySummary.Coverage</c> takes. Only
    /// <see cref="Modeled"/> and <see cref="Indeterminate"/> reach the wire:
    /// <see cref="None"/> is the answer that stops the topics being published.
    /// </summary>
    public static class ReliabilityCoverage
    {
        /// <summary>TestFlight is not installed.</summary>
        public const string None = "none";

        /// <summary>TestFlight is installed and not even an engine's part status could be read.</summary>
        public const string Indeterminate = "indeterminate";

        /// <summary>TestFlight is installed and reporting on the craft's engines.</summary>
        public const string Modeled = "modeled";
    }
}
