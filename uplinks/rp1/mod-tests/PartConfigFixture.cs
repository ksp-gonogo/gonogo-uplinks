using System;
using System.Collections.Generic;

namespace GonogoRp1Uplink.Tests
{
    /// <summary>
    /// A part module declaring the configuration convention RP-1's validator
    /// looks for, answering whatever the test sets. The signature is the real
    /// one exactly, because the walk finds it by exact signature and a stand-in
    /// that merely resembled it would prove a lookup nobody makes.
    /// </summary>
    public sealed class ConfiguredModule
    {
        public bool Valid = true;
        public string? Error;
        public bool CanBeResolved;
        public float CostToResolve;
        public string? TechToResolve;

        /// <summary>Made to throw, as a module with a bug in its own check does.</summary>
        public bool ThrowOnValidate;

        /// <summary>What ResolveValidationError answers, and whether it clears the error.</summary>
        public bool ResolveSucceeds = true;

        /// <summary>The patcher's tech at each resolve, so a test can prove it was pointed first.</summary>
        public readonly List<string?> ResolvedWithTech = new List<string?>();

        public bool Validate(out string? error, out bool canBeResolved, out float costToResolve, out string? techToResolve)
        {
            if (ThrowOnValidate)
            {
                throw new InvalidOperationException("config table missing");
            }
            error = Error;
            canBeResolved = CanBeResolved;
            costToResolve = CostToResolve;
            techToResolve = TechToResolve;
            return Valid;
        }

        public bool ResolveValidationError()
        {
            ResolvedWithTech.Add(RP0.Harmony.RFECMPatcher.techNode);
            if (ResolveSucceeds)
            {
                Valid = true;
            }
            return ResolveSucceeds;
        }
    }

    /// <summary>A module with nothing to say about its configuration, which most are.</summary>
    public sealed class PlainModule
    {
    }
}

namespace RP0.Harmony
{
    /// <summary>
    /// RP-1's RealFuels purchase patch, reduced to the static its PurchaseConfig
    /// points at a tech before resolving. Internal, as RP-1 declares it.
    /// </summary>
    internal static class RFECMPatcher
    {
        internal static string? techNode;
    }
}
