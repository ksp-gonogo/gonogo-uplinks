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

namespace RealFuels.Tanks
{
    /// <summary>RealFuels' tank definition, reduced to the two names Validate quotes.</summary>
    public sealed class TankDefinition
    {
        public TankDefinition(string name, string title)
        {
            this.name = name;
            Title = title;
        }

#pragma warning disable IDE1006
        public string name;
#pragma warning restore IDE1006

        public string Title;
    }

    /// <summary>
    /// RealFuels' tank module, reduced to what its Validate reads. The instance
    /// list starts empty and is only ever filled from the part prefab's, which is
    /// what RealFuels' own OnAwake does in the editor and in flight and nowhere
    /// else, so a module loaded at the Space Center holds an empty list.
    /// </summary>
    public sealed class ModuleFuelTanks
    {
#pragma warning disable IDE1006
        public string type = "";

        public List<TankDefinition> typesAvailable = new List<TankDefinition>();
#pragma warning restore IDE1006

        /// <summary>RealFuels' global definitions, by name, which Validate resolves the module's type through.</summary>
        public static readonly Dictionary<string, TankDefinition> Definitions = new Dictionary<string, TankDefinition>();

        public bool Validate(out string? error, out bool canBeResolved, out float costToResolve, out string? techToResolve)
        {
            error = null;
            canBeResolved = false;
            costToResolve = 0f;
            techToResolve = null;
            if (!Definitions.TryGetValue(type, out var definition))
            {
                error = "definition " + type + " has no global definition";
            }
            else if (!typesAvailable.Contains(definition))
            {
                error = "definition " + definition.Title + " is not available";
            }
            return error == null;
        }
    }
}

namespace ProceduralParts
{
    /// <summary>
    /// ProceduralParts' part module, reduced to its density check. A craft saved
    /// without a density leaves the field at -1, which only the editor's own
    /// start-up turns into the part's minimum.
    /// </summary>
    public sealed class ProceduralPart
    {
#pragma warning disable IDE1006
        public float density = -1f;

        public float minDensity;
#pragma warning restore IDE1006

        public bool Validate(out string? error, out bool canBeResolved, out float costToResolve, out string? techToResolve)
        {
            error = null;
            canBeResolved = false;
            costToResolve = 0f;
            techToResolve = null;
            if (density + 0.0001 < minDensity)
            {
                error = "density needs to be " + minDensity.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture) + " or higher";
                return false;
            }
            return true;
        }
    }
}

namespace Keramzit
{
    /// <summary>ProceduralFairings' side module, the same density check behind a different default.</summary>
    public sealed class ProceduralFairingSide
    {
#pragma warning disable IDE1006
        public float density = -1f;

        public float minDensity = 0.01f;
#pragma warning restore IDE1006

        public bool Validate(out string? error, out bool canBeResolved, out float costToResolve, out string? techToResolve)
        {
            error = null;
            canBeResolved = false;
            costToResolve = 0f;
            techToResolve = null;
            if (density + 0.0001 < minDensity)
            {
                error = "density needs to be " + minDensity.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture) + " or higher";
                return false;
            }
            return true;
        }
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
