using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// A contact link model describes itself as plain data, survives the trip
    /// through a save's JSON, and is built again with the same margin, so a
    /// centre that cannot hear a craft after a load still plans its pairs on
    /// the dishes and aims it last heard of.
    /// </summary>
    public class RaContactLinkPersistenceTests
    {
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

        private static Dictionary<string, object?> ThroughASave(Dictionary<string, object?> described) =>
            (Dictionary<string, object?>)Plain(JsonDocument.Parse(JsonSerializer.Serialize(described)).RootElement)!;

        /// <summary>The restore entry point without a game, which it never touches.</summary>
        private sealed class Restorer : ILinkModelRestorer
        {
            public IContactLinkModel? RestoreLinkModel(string modelId, IReadOnlyDictionary<string, object?> data) =>
                modelId == RaContactLinkModel.Model ? RaContactLinkModel.From(data) : null;
        }

        private static RaContactLinkModel RigPair() =>
            new RaContactLinkModel(RaRigPair.InSpace, RaRigPair.Landed, minRelayTechLevel: 2, occluders: RaRigPair.Occluders);

        [Fact]
        public void TheModelKeepsTheRestorerContract()
        {
            var station = new RaPlannedAntenna
            {
                Steerable = true, BeamwidthRadians = 0.3, Band = "L", TxPowerDbm = 40.0, GainDbi = 30.0, FrequencyHz = 1.62e9,
                SymbolRateHz = 31500.0, MinSymbolRateHz = 1.0, NoiseTemperatureKelvin = 50.0, Aim = RaAimKind.Untargeted, GroundBodyIndex = 1,
            };
            var model = new RaContactLinkModel(RaRigPair.InSpace, new[] { station }, 2, false, true, RaRigPair.Occluders);

            LinkModelPersistenceConformance.AssertRestorerContract(
                new Restorer(),
                model,
                ThroughASave,
                new RaRigPair.Positions(),
                new (Sitrep.Contract.Vector3d From, Sitrep.Contract.Vector3d To)[]
                {
                    (RaRigPair.Craft, RaRigPair.Surface),
                    (new Sitrep.Contract.Vector3d(1e9, 2e9, 0), RaRigPair.Surface),
                    (new Sitrep.Contract.Vector3d(3e7, 0, 0), new Sitrep.Contract.Vector3d(0, 600_100, 0)),
                });
        }

        [Fact]
        public void ARestoredModelStillRefusesALandedDishAimedAtItsOwnBodysCentre()
        {
            var restored = new Restorer().RestoreLinkModel(RaContactLinkModel.Model, ThroughASave(RigPair().Describe()));

            var model = Assert.IsType<RaContactLinkModel>(restored);
            Assert.True(model.MarginAt(0.0, RaRigPair.Craft, RaRigPair.Surface, new RaRigPair.Positions()) < 0.0);
            Assert.Equal(
                RigPair().MarginAt(0.0, RaRigPair.Craft, RaRigPair.Surface, new RaRigPair.Positions()),
                model.MarginAt(0.0, RaRigPair.Craft, RaRigPair.Surface, new RaRigPair.Positions()));
        }

        [Fact]
        public void ARestoredModelNamesTheSameDishes()
        {
            var turned = new RaContactLinkModel(RaRigPair.InSpace, RaRigPair.Turned, occluders: RaRigPair.Occluders);
            var restored = Assert.IsType<RaContactLinkModel>(RaContactLinkModel.From(ThroughASave(turned.Describe())));

            Assert.Equal(
                turned.DishesAt(0.0, RaRigPair.Craft, RaRigPair.Surface, new RaRigPair.Positions()),
                restored.DishesAt(0.0, RaRigPair.Craft, RaRigPair.Surface, new RaRigPair.Positions()));
        }
    }
}
