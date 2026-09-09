namespace GonogoAvionicsUplink
{
    /// <summary>
    /// The reflected avionics reading: the MAX-across-parts controllable-mass
    /// limit (tonnes) and whether any unit is switched on. KSP-free so the pure
    /// mapper + its headless tests never pull in the reflection/KSP surface.
    /// </summary>
    public sealed class AvionicsRaw
    {
        /// <summary>
        /// The MAX across parts of each part's summed <c>CurrentMassLimit</c>
        /// (tonnes), and <c>null</c> when any avionics module's limit could not
        /// be read at all.
        ///
        /// <para>Nullable for the same reason <see cref="AvionicsActive"/> is,
        /// and the max is what disguised it. An unreadable limit skipped the sum
        /// silently, so a vessel whose best unit did not answer published a
        /// PARTIAL sum wearing a total's name: the mapper then compared vessel
        /// mass against a ceiling that was too low and the widget drew NO-GO in
        /// alert tone, "Controllable 0 t", for a craft RP-1 was flying
        /// perfectly well. A maximum over a set holding an unknown is a lower
        /// bound, not a maximum, so the total is UNKNOWN rather than
        /// smaller.</para>
        /// </summary>
        public double? ControllableMassTons;

        /// <summary>
        /// True when some unit definitely reported itself switched on, false when
        /// every unit definitely reported itself off, and <c>null</c> when no
        /// unit's switch could be read at all.
        ///
        /// <para>Nullable deliberately. Coalesced to true
        /// (<c>systemEnabled ?? true</c>) a member that did not bind, or a read
        /// that threw, published a confident "avionics on" for a switch nobody
        /// read, and the widget drew a GO/NO-GO off it. That is the failure the
        /// TestFlight Uplink's own <c>EngineReliabilityRaw</c> header records,
        /// where three of four reflected members did not exist and every craft
        /// therefore reported all nominal.</para>
        /// </summary>
        public bool? AvionicsActive;
    }
}
