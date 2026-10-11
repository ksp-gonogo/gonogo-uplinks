using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// The producer's flight-plan burns, answered as the generalised
    /// <c>vessel.maneuver</c> plan rather than as a producer-shaped payload.
    ///
    /// <para><b>What this makes true.</b> A widget written against
    /// <c>vessel.maneuver</c> renders a Principia plan's instants and delta-v
    /// without knowing Principia exists. The node keeps stock's shape, so the
    /// Frenet components go out under an unnamed frame and the engine model stays
    /// on <c>principia.plan</c>.</para>
    ///
    /// <para><b>The burn instant is the half-delta-v point, not ignition.</b> A
    /// stock node's <c>Ut</c> is the instant an impulsive burn happens, and the
    /// impulsive equivalent of a finite burn is the instant half its delta-v has
    /// been delivered, which is what the producer's own
    /// <c>TimeToHalfDeltaVSeconds</c> measures from ignition. Reporting ignition
    /// as the instant would make every countdown fire early by half a burn, and
    /// would do it invisibly, because ignition IS an instant and reads as a
    /// plausible one. Ignition and cutoff still travel in their own fields, so
    /// nothing is lost by not putting one of them in this slot.</para>
    ///
    /// <para><b>The ids say where they came from.</b> The producer addresses its
    /// burns by index and has no stable per-burn id to offer, so an id here is
    /// built from that index. It is prefixed rather than published bare so it can
    /// never be mistaken for a stock node's guid. A bare "0" reaching the stock
    /// actuator, which resolves only an exact guid match, answers NotFound every
    /// time.</para>
    /// </summary>
    internal sealed class PrincipiaManeuverPlanSource : IManeuverPlanSource
    {
        /// <summary>Marks an id as the producer's rather than the game's.</summary>
        internal const string IdPrefix = "principia:";

        private readonly Func<PlanObservation?> _observation;

        internal PrincipiaManeuverPlanSource(Func<PlanObservation?> observation)
        {
            _observation = observation ?? throw new ArgumentNullException(nameof(observation));
        }

        public string ProviderId => "principia";

        public IList<Sitrep.Contract.ManeuverNode>? Plan() => Map(_observation());

        /// <summary>
        /// The observed plan as generalised nodes.
        ///
        /// <para>Null ONLY when nothing has been observed. A craft that was read
        /// and holds no flight plan answers with an EMPTY list, because this
        /// planner can make one for it and simply has not: null on that seam is
        /// reserved for "this craft cannot hold a plan at all", which is how an
        /// un-upgraded Tracking Station reaches a client, and it is what decides
        /// whether the wire names a planner beside the nodes. Collapsing the two
        /// leaves a client unable to tell an install with an n-body planner from
        /// one with none.</para>
        /// </summary>
        internal static IList<Sitrep.Contract.ManeuverNode>? Map(PlanObservation? plan)
        {
            if (plan == null)
            {
                return null;
            }

            var nodes = new List<Sitrep.Contract.ManeuverNode>();
            if (!plan.PlanExists)
            {
                return nodes;
            }

            foreach (var burn in plan.Burns)
            {
                var node = MapBurn(burn);
                if (node != null)
                {
                    nodes.Add(node);
                }
            }
            return nodes;
        }

        /// <summary>
        /// One burn as a node, or null when it has no readable instant.
        ///
        /// <para>A node's instant is not optional, and a burn whose ignition time
        /// could not be read is a burn we failed to read rather than one that
        /// happens at no particular time. The choice is between omitting it and
        /// publishing it at UT zero, and zero renders as a burn in the deep past:
        /// an operator would see a manoeuvre that is not there, at a time it is
        /// not at, rather than a plan one short.</para>
        /// </summary>
        internal static Sitrep.Contract.ManeuverNode? MapBurn(PlannedBurnObservation burn)
        {
            var instant = ImpulsiveInstant(burn);
            if (instant == null)
            {
                return null;
            }

            return new Sitrep.Contract.ManeuverNode
            {
                Id = IdPrefix + burn.Index.ToString(),
                Ut = instant.Value,
                IgnitionUt = burn.IgnitionUt,
                CutoffUt = burn.CutoffUt,
                // The producer works in the Frenet trihedron, which the shared
                // node does not name, so the frame is Unknown: the three
                // positional slots carry tangent, normal and binormal in that
                // order, and a reader labels them neutrally rather than as
                // radial, normal and prograde. The engine, mass and attitude hold
                // travel on principia.plan, where the basis is stated.
                Frame = ManeuverFrame.Unknown,
                DvRadial = burn.DeltaVTangent,
                DvNormal = burn.DeltaVNormal,
                DvPrograde = burn.DeltaVBinormal,
                DvTotal = TotalOf(burn),
                // Deliberately empty rather than absent. The producer renders a
                // plan's segments through calls this Uplink refuses by name for
                // aborting the process on the player's own UI state, so there is
                // no post-burn patch chain to offer. An empty chain is what a
                // reader is already told to expect from a planner that integrates
                // rather than one that patches conics.
                Patches = new List<OrbitPatch>(),
            };
        }

        /// <summary>
        /// The instant an equivalent impulsive burn would happen: ignition plus
        /// the offset to half the delta-v.
        ///
        /// <para>Falls back to ignition when the producer could not offer the
        /// offset, which is the closest true instant available rather than a
        /// guess, and is stated here so a reader comparing two plans knows the two
        /// numbers can mean slightly different things.</para>
        /// </summary>
        internal static double? ImpulsiveInstant(PlannedBurnObservation burn)
        {
            if (burn.IgnitionUt == null)
            {
                return null;
            }
            if (burn.TimeToHalfDeltaVSeconds == null)
            {
                return burn.IgnitionUt;
            }
            return burn.IgnitionUt + burn.TimeToHalfDeltaVSeconds;
        }

        /// <summary>
        /// The burn's magnitude, from the three components the producer gave.
        ///
        /// <para>Null when any component is missing rather than summed from what
        /// arrived: a total built from two of three axes is smaller than the real
        /// burn and reads as a perfectly ordinary number.</para>
        /// </summary>
        internal static double? TotalOf(PlannedBurnObservation burn)
        {
            if (burn.DeltaVTangent == null
                || burn.DeltaVNormal == null
                || burn.DeltaVBinormal == null)
            {
                return null;
            }

            var t = burn.DeltaVTangent.Value;
            var n = burn.DeltaVNormal.Value;
            var b = burn.DeltaVBinormal.Value;
            return Math.Sqrt((t * t) + (n * n) + (b * b));
        }
    }
}
