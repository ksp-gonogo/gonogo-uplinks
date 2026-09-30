namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The values <c>KerbalismReliabilitySummary.Coverage</c> takes. Only
    /// <see cref="Modeled"/> and <see cref="Indeterminate"/> reach the wire:
    /// <see cref="Disabled"/> is the answer that stops the topic being published.
    /// </summary>
    public static class ReliabilityCoverage
    {
        /// <summary>Kerbalism's reliability feature or its MTBF failures are switched off in this save.</summary>
        public const string Disabled = "disabled";

        /// <summary>Kerbalism could not say whether either switch is on.</summary>
        public const string Indeterminate = "indeterminate";

        /// <summary>Kerbalism is breaking parts in this save.</summary>
        public const string Modeled = "modeled";
    }
}
