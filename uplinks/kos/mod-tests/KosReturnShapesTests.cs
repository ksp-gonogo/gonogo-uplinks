// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System.Collections.Generic;
using Gonogo.KosUplink;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// The wire shape of each structured value, which needs no kOS assembly.
    /// </summary>
    public class KosReturnShapesTests
    {
        [Fact]
        public void PartAndVessel_CarryTheirNameAndId()
        {
            var part = KosReturnShapes.Part("fuelTank", "42");
            Assert.Equal("part", part["kind"]);
            Assert.Equal("fuelTank", part["name"]);
            Assert.Equal("42", part["id"]);

            var vessel = KosReturnShapes.Vessel("Kerbal X", "guid");
            Assert.Equal("vessel", vessel["kind"]);
            Assert.Equal("Kerbal X", vessel["name"]);
            Assert.Equal("guid", vessel["id"]);
        }

        [Fact]
        public void Entry_PairsAKeyTextWithItsValue()
        {
            var entry = KosReturnShapes.Entry("k", 1.0);

            Assert.Equal("k", entry["key"]);
            Assert.Equal(1.0, entry["value"]);
        }

        [Fact]
        public void QuaternionEuler_WrapsANegativeTurnIntoZeroToThreeSixty()
        {
            var half = System.Math.PI / 4.0;
            var (_, yaw, _) = KosQuaternion.ToEulerDegrees(0, -System.Math.Sin(half), 0, System.Math.Cos(half));

            Assert.Equal(270.0, yaw, 3);
        }

        [Fact]
        public void QuaternionEuler_IdentityIsZero()
        {
            var (pitch, yaw, roll) = KosQuaternion.ToEulerDegrees(0, 0, 0, 1);

            Assert.Equal(0.0, pitch, 6);
            Assert.Equal(0.0, yaw, 6);
            Assert.Equal(0.0, roll, 6);
        }

        [Fact]
        public void Other_CarriesTheTypeNameAndText()
        {
            var other = KosReturnShapes.Other("PIDLoop", "PIDLoop");

            Assert.Equal("other", other["kind"]);
            Assert.Equal("PIDLoop", other["type"]);
            Assert.Equal("PIDLoop", other["text"]);
        }
    }
}
