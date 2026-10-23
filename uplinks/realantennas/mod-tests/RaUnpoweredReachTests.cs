using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// A craft with no electric charge aboard carries no link, so a plan built on
    /// its reach must not promise it a window. The reason is the model's id and
    /// name, which the plan's trace reports beside the limit.
    /// </summary>
    public class RaUnpoweredReachTests
    {
        private static readonly ICommsReachModel Budget = new MaxRangeReachModel(RaReach.ModelId, RaReach.ModelName, 4.0e9);

        [Fact]
        public void AnEndWithNoChargeReachesNowhereAndSaysWhy()
        {
            var model = RaReach.WithPower(Budget, fromHasCharge: false, toHasCharge: true);

            Assert.Equal(0.0, model.MaxRangeMeters);
            Assert.Equal(RaReach.UnpoweredModelId, model.ModelId);
            Assert.Contains("electric charge", model.ModelName);
            Assert.Equal(CommsNoReachReasons.Unpowered, (model as ICommsNoReachReason)?.NoReachReason);
            Assert.False(CommsReachModels.Reaches(model, 1.0));
        }

        [Fact]
        public void EitherEndOutOfChargeIsEnough()
        {
            var model = RaReach.WithPower(Budget, fromHasCharge: true, toHasCharge: false);

            Assert.Equal(0.0, model.MaxRangeMeters);
        }

        [Fact]
        public void AnUnreadableChargeIsNotTakenAsNone()
        {
            var model = RaReach.WithPower(Budget, fromHasCharge: null, toHasCharge: true);

            Assert.Same(Budget, model);
        }

        [Theory]
        [InlineData(false, true, true)]
        [InlineData(true, false, true)]
        [InlineData(null, false, true)]
        [InlineData(true, true, false)]
        [InlineData(null, null, false)]
        [InlineData(null, true, false)]
        public void OnlyAnEndKnownToHoldNoChargeIsUnpowered(bool? from, bool? to, bool unpowered)
        {
            Assert.Equal(unpowered, RaReach.AnEndIsUnpowered(from, to));
        }

        [Fact]
        public void PoweredEndsKeepTheLinkBudgetsReach()
        {
            var model = RaReach.WithPower(Budget, fromHasCharge: true, toHasCharge: true);

            Assert.Same(Budget, model);
        }

        [Fact]
        public void NoChargeOutranksAReachThatCouldNotBeRead()
        {
            var model = RaReach.WithPower(CommsReachModels.Unknown, fromHasCharge: false, toHasCharge: null);

            Assert.Equal(0.0, model.MaxRangeMeters);
            Assert.Equal(RaReach.UnpoweredModelId, model.ModelId);
        }
    }
}
