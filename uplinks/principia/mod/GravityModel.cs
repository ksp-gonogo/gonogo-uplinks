using System;
using System.Collections.Generic;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// The producer's gravity model: one entry per body, with the parameters the
    /// ephemeris and trajectory bounds need.
    ///
    /// <para>Read from the producer's own configuration rather than taken from
    /// stock, whose single GM per body is not the number the producer integrates
    /// against. Plain data with no reader attached, so the bound arithmetic that
    /// consumes it stays testable with no game.</para>
    /// </summary>
    public sealed class GravityModel
    {
        public GravityModel(string modelId, IReadOnlyList<GravityModelBody> bodies)
        {
            ModelId = modelId ?? throw new ArgumentNullException(nameof(modelId));
            Bodies = bodies ?? throw new ArgumentNullException(nameof(bodies));
        }

        /// <summary>Which model this is, for provenance. A name, so nothing may branch on it.</summary>
        public string ModelId { get; }

        /// <summary>Every body the model describes, in the order it was read.</summary>
        public IReadOnlyList<GravityModelBody> Bodies { get; }

        /// <summary>
        /// The body of that name, or null when the model does not describe one. A
        /// body that cannot be resolved is a term left out of a bound, never one
        /// filled with a stock value.
        /// </summary>
        public GravityModelBody? Find(string? name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            for (var i = 0; i < Bodies.Count; i++)
            {
                if (string.Equals(Bodies[i].Name, name, StringComparison.Ordinal))
                {
                    return Bodies[i];
                }
            }
            return null;
        }
    }

    /// <summary>One body's gravitational parameters, as the model states them.</summary>
    public sealed class GravityModelBody
    {
        public GravityModelBody(
            string name,
            double gravitationalParameter,
            double? referenceRadius = null,
            double? j2 = null)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            GravitationalParameter = gravitationalParameter;
            ReferenceRadius = referenceRadius;
            J2 = j2;
        }

        public string Name { get; }

        /// <summary>GM, in metres cubed per second squared.</summary>
        public double GravitationalParameter { get; }

        /// <summary>The radius the geopotential coefficients are referred to, or null for a point mass.</summary>
        public double? ReferenceRadius { get; }

        /// <summary>The second zonal harmonic, when the model states one. Summed into a craft's horizon bound as a secular drift (see <see cref="PrincipiaHorizonBound.J2DriftRate"/>), together with <see cref="ReferenceRadius"/>.</summary>
        public double? J2 { get; }
    }

    /// <summary>
    /// Supplies the gravity model this Uplink's propagation provider bounds its
    /// trajectories and ephemerides against. <see cref="Model"/> is null when the
    /// configuration could not be found or parsed, and that null means no bound,
    /// never a bound built from stock values.
    /// </summary>
    public interface IGravityModelSource
    {
        /// <summary>The model in force for the loaded game, or null when none can be described.</summary>
        GravityModel? Model { get; }
    }
}
