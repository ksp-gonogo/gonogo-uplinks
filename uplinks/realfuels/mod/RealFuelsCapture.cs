using System.Collections.Generic;

namespace GonogoRealFuelsUplink
{
    /// <summary>
    /// Pure mappers: turn the reflected RealFuels readings into the
    /// <c>realfuels.engines</c> and <c>realfuels.boiloff</c> dicts. KSP-free and
    /// side-effect-free, so the ignition semantics, the boiloff unit conversion
    /// and the finiteness policy are all unit-tested headless.
    ///
    /// <para>This is where RealFuels' traps are unpicked, and it is deliberately
    /// the only place any of the rules is written down.</para>
    /// </summary>
    public static class RealFuelsCapture
    {
        /// <summary>Tonnes to kilograms, for the boiloff rate.</summary>
        private const double KilogramsPerTonne = 1000.0;

        /// <summary>
        /// The Uplink's finiteness policy, applied to every double that leaves
        /// here for the wire: a NaN or an infinity is not a reading and becomes
        /// null.
        ///
        /// <para>RealFuels computes these from numbers a part config supplies and
        /// divides by quantities that reach zero, so a non-finite return is a
        /// real one rather than a hypothetical. Published, it is worse than
        /// absent: a comparison against a NaN is false whichever way it is
        /// written, so every band and every threshold downstream quietly answers
        /// "no" and the operator reads a nominal engine.</para>
        /// </summary>
        public static double? Finite(double? value) =>
            value != null && !double.IsNaN(value.Value) && !double.IsInfinity(value.Value)
                ? value
                : null;

        /// <summary>
        /// True when the engine can be relit without limit.
        /// <c>ModuleEnginesRF.GetUllageIgnition</c> asks this first and asks it
        /// this way: the game-wide switch being off makes every budget moot, and
        /// any negative count is RealFuels' unlimited sentinel rather than a
        /// deficit.
        /// </summary>
        public static bool? IgnitionsUnlimited(int? ignitions, bool? ignitionsLimited)
        {
            if (ignitions == null || ignitionsLimited == null)
            {
                return null;
            }
            return !ignitionsLimited.Value || ignitions.Value < 0;
        }

        /// <summary>
        /// True when the engine will light only on a launch clamp.
        ///
        /// <para>The reading is <c>ignitions == 0</c>, and it is a state rather
        /// than an exhausted budget: <c>IgnitionUpdate</c> refuses the light
        /// outright unless the vessel has a clamp attached, so there is no
        /// in-flight relight to be had at all. It survives to the live module
        /// only for a part whose config sets <c>literalZeroIgnitions</c>,
        /// because <c>ConfigIgnitions</c> rewrites every other configured zero to
        /// the unlimited sentinel on the way in.</para>
        /// </summary>
        public static bool? GroundIgnitionOnly(int? ignitions, bool? ignitionsLimited)
        {
            if (ignitions == null || ignitionsLimited == null)
            {
                return null;
            }
            return ignitionsLimited.Value && ignitions.Value == 0;
        }

        /// <summary>
        /// Boiloff as a RATE in kg/s, from the mass RealFuels accumulated and the
        /// interval it accumulated over.
        ///
        /// <para>RealFuels' <c>BoiloffMassRate</c> is not one: its base
        /// accumulation multiplies by the interval before adding, so the property
        /// holds tonnes over the physics frame just past. Dividing by the same
        /// interval RealFuels was handed is what makes the published field's name
        /// true. A non-positive or missing interval yields null, because a mass
        /// over an unknown time is not a rate of zero.</para>
        /// </summary>
        public static double? BoiloffRateKgPerSecond(double? boiloffMassTons, double? intervalSeconds)
        {
            var mass = Finite(boiloffMassTons);
            var interval = Finite(intervalSeconds);
            // Written on the finite values rather than on the arguments: a NaN
            // interval satisfies <= 0.0 no more than it satisfies > 0.0, so the
            // guard as it stood passed it through and the rate came out NaN.
            if (mass == null || interval == null || interval.Value <= 0.0)
            {
                return null;
            }
            return Finite(mass.Value * KilogramsPerTonne / interval.Value);
        }

        /// <summary>
        /// The vessel's boiloff, folded over its tanks. Lives here rather than in
        /// the reflection walk so the fold's absence rules are testable headless.
        ///
        /// <para>A tank whose <c>SupportsBoiloff</c> could not be read, or which
        /// supports boiloff but whose mass could not be read, makes the VESSEL's
        /// mass and tank count unknown. Both were previously skipped: the mass
        /// became a sum over the tanks that answered, and the count became the
        /// number of tanks that answered yes, so an install where the member had
        /// moved published zero cryogenic tanks, which the contract states means
        /// the vessel has none and will never boil off.</para>
        /// </summary>
        public static RealFuelsBoiloffRaw VesselBoiloff(
            IEnumerable<TankBoiloffReading> tanks,
            double? intervalSeconds)
        {
            double massTons = 0.0;
            var tankCount = 0;
            var readAny = false;
            var unreadable = false;

            foreach (var tank in tanks)
            {
                if (tank.SupportsBoiloff == null)
                {
                    unreadable = true;
                    continue;
                }
                if (!tank.SupportsBoiloff.Value)
                {
                    continue;
                }
                tankCount++;
                var mass = Finite(tank.MassTons);
                if (mass == null)
                {
                    unreadable = true;
                    continue;
                }
                massTons += mass.Value;
                readAny = true;
            }

            return new RealFuelsBoiloffRaw
            {
                BoiloffMassTons = readAny && !unreadable ? massTons : (double?)null,
                IntervalSeconds = intervalSeconds,
                CryogenicTankCount = unreadable ? (int?)null : tankCount,
            };
        }

        /// <summary>Builds the <c>realfuels.engines</c> payload. Null raw means
        /// the vessel could not be read at all, and yields a null engine list
        /// rather than an empty one.</summary>
        public static Dictionary<string, object?> BuildEngines(RealFuelsVesselRaw? raw)
        {
            if (raw == null)
            {
                return new Dictionary<string, object?>
                {
                    ["ignitionsLimited"] = null,
                    ["ullageSimulated"] = null,
                    ["engines"] = null,
                };
            }

            var rows = new List<Dictionary<string, object?>>(raw.Engines.Count);
            foreach (var e in raw.Engines)
            {
                rows.Add(new Dictionary<string, object?>
                {
                    ["partId"] = e.PartId,
                    ["partName"] = e.PartName,
                    ["ignitionsRemaining"] = e.Ignitions,
                    ["ignitionsUnlimited"] = IgnitionsUnlimited(e.Ignitions, raw.IgnitionsLimited),
                    ["groundIgnitionOnly"] = GroundIgnitionOnly(e.Ignitions, raw.IgnitionsLimited),
                    ["literalZeroIgnitions"] = e.LiteralZeroIgnitions,
                    ["ullageModelled"] = e.UllageModelled,
                    ["ullageStability"] = Finite(e.UllageStability),
                    ["ignitionProbability"] = Finite(e.IgnitionProbability),
                    ["pressureFed"] = e.PressureFed,
                    ["feedPressureOk"] = e.FeedPressureOk,
                    ["ratedBurnTimeSeconds"] = Finite(e.RatedBurnTimeSeconds),
                    ["ratedContinuousBurnTimeSeconds"] = Finite(e.RatedContinuousBurnTimeSeconds),
                    ["predictedMaximumResiduals"] = Finite(e.PredictedMaximumResiduals),
                });
            }

            return new Dictionary<string, object?>
            {
                ["ignitionsLimited"] = raw.IgnitionsLimited,
                ["ullageSimulated"] = raw.UllageSimulated,
                ["engines"] = rows,
            };
        }

        /// <summary>Builds the <c>realfuels.boiloff</c> payload.</summary>
        public static Dictionary<string, object?> BuildBoiloff(RealFuelsBoiloffRaw? raw)
        {
            if (raw == null)
            {
                return new Dictionary<string, object?>
                {
                    ["boiloffRate"] = null,
                    ["cryogenicTankCount"] = null,
                };
            }
            return new Dictionary<string, object?>
            {
                ["boiloffRate"] = BoiloffRateKgPerSecond(raw.BoiloffMassTons, raw.IntervalSeconds),
                ["cryogenicTankCount"] = raw.CryogenicTankCount,
            };
        }
    }
}
