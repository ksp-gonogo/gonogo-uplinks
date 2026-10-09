using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Gonogo.RealAntennasUplink;
using Xunit;

namespace Gonogo.RealAntennasUplink.Tests
{
    /// <summary>
    /// A link strength describes itself as plain data, survives the trip through
    /// a save's JSON, and is built again answering exactly as it did.
    /// </summary>
    public class RaLinkStrengthPersistenceTests
    {
        private static RaPlannedAntenna Antenna(double txPowerDbm, string band, bool steerable, RaAimKind aim = RaAimKind.Untargeted) => new RaPlannedAntenna
        {
            Id = "antenna-" + txPowerDbm,
            DishId = steerable ? "vessel:abc#1/0" : null,
            Steerable = steerable,
            Band = band,
            TxPowerDbm = txPowerDbm,
            GainDbi = 12.5,
            FrequencyHz = 2.25e9,
            SymbolRateHz = 1000.0,
            MinSymbolRateHz = 125.0,
            ModulationBits = 3,
            NoiseTemperatureKelvin = 200.0,
            RequiredEbN0Db = 1.5,
            TechLevel = 5,
            EncoderName = "Turbo",
            EncoderTechLevel = 5,
            CodingRate = 0.5,
            EncoderRequiredEbN0Db = 2.5,
            BeamwidthRadians = steerable ? 0.28 : (double?)null,
            PowerDrawEc = 12.0,
            Aim = aim,
            AimLabel = aim == RaAimKind.BodyCentre ? "Kerbin" : null,
            AimBodyIndex = aim == RaAimKind.BodyCentre ? 1 : (int?)null,
        };

        private static object? Plain(JsonElement e) => e.ValueKind switch
        {
            JsonValueKind.Object => e.EnumerateObject().ToDictionary(p => p.Name, p => Plain(p.Value)),
            JsonValueKind.Array => e.EnumerateArray().Select(Plain).ToList(),
            JsonValueKind.String => e.GetString(),
            JsonValueKind.Number => e.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };

        private static RaLinkStrength ThroughASave(RaLinkStrength strength)
        {
            var json = JsonSerializer.Serialize(strength.Describe());
            var back = (Dictionary<string, object?>)Plain(JsonDocument.Parse(json).RootElement)!;
            return Assert.IsType<RaLinkStrength>(new RaCommsBackendRestorerProbe().Restore(strength.ModelId, back));
        }

        /// <summary>The restore entry point without a game: it never touches one.</summary>
        private sealed class RaCommsBackendRestorerProbe
        {
            public Sitrep.Contract.IContactLinkStrength? Restore(string model, IReadOnlyDictionary<string, object?> data) =>
                model == RaLinkStrength.Model ? RaLinkStrength.From(data) : null;
        }

        [Fact]
        public void ARestoredStrengthAnswersAsTheOriginalDidAtEverySeparationWithTheSameFacts()
        {
            var original = new RaLinkStrength(
                new[] { Antenna(40.0, "S", steerable: true, RaAimKind.BodyCentre), Antenna(30.0, "S", steerable: false) },
                new[] { Antenna(50.0, "S", steerable: false) });

            var restored = ThroughASave(original);

            for (var separation = 1_000.0; separation < 1e12; separation *= 7.0)
            {
                var was = original.FactsAt(0.0, separation);
                var now = restored.FactsAt(0.0, separation);
                Assert.Equal(was.Strength, now.Strength, 12);
                Assert.Equal(
                    JsonSerializer.Serialize(was.Extensions),
                    JsonSerializer.Serialize(now.Extensions));
            }
        }

        [Fact]
        public void TheBackendMeetsTheRestorerConformanceAssertion()
        {
            var sample = new RaLinkStrength(
                new[] { Antenna(40.0, "S", steerable: true, RaAimKind.BodyCentre), Antenna(30.0, "S", steerable: false) },
                new[] { Antenna(50.0, "S", steerable: false) });

            Sitrep.Contract.TestSupport.LinkStrengthPersistenceConformance.AssertRestorerContract(
                new RestorerProbe(),
                sample,
                described => (Dictionary<string, object?>)Plain(JsonDocument.Parse(JsonSerializer.Serialize(described)).RootElement)!,
                new[] { 1_000.0, 1e7, 1e9, 1e11 });
        }

        private sealed class RestorerProbe : Sitrep.Contract.ILinkStrengthRestorer
        {
            public Sitrep.Contract.IContactLinkStrength? RestoreLinkStrength(string modelId, IReadOnlyDictionary<string, object?> data) =>
                modelId == RaLinkStrength.Model ? RaLinkStrength.From(data) : null;
        }

        [Fact]
        public void DataThisBuildDidNotWriteBuildsNothing()
        {
            Assert.Null(RaLinkStrength.From(new Dictionary<string, object?> { ["from"] = "nonsense", ["to"] = new List<object?>() }));
            Assert.Null(RaLinkStrength.From(new Dictionary<string, object?>()));
            Assert.Null(RaLinkStrength.From(new Dictionary<string, object?> { ["from"] = new List<object?> { 3.0 }, ["to"] = new List<object?>() }));
        }
    }
}
