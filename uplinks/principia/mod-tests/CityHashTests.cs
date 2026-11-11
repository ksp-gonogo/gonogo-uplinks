using GonogoPrincipiaUplink;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// Every expected value here was read from <c>principia__CityHash64</c> in the Linux
    /// build of 2026110907-Lie, one per length band of the algorithm, so a body key
    /// computed here is the one that build gives the same body.
    /// </summary>
    public class CityHashTests
    {
        [Theory]
        [InlineData("", 11160318154034397263UL)]
        [InlineData("a", 12917804110809363939UL)]
        [InlineData("Sun", 5157089753190040521UL)]
        [InlineData("Mun", 15131440161429371143UL)]
        [InlineData("Moho", 2997615479375380140UL)]
        [InlineData("Kerbin", 6228157669635263037UL)]
        [InlineData("Minmus", 332165097493987525UL)]
        [InlineData("Médée", 15864071521185582049UL)]
        [InlineData("abcdefghij", 9960479591422212091UL)]
        [InlineData("Kerbol System Barycentre", 11545392500782823819UL)]
        [InlineData("Sun Earth Moon Mars Jupiter Saturn Uranus", 3080020999799224657UL)]
        [InlineData(
            "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789",
            13950675445657586398UL)]
        public void AgreesWithPrincipiasOwnHash(string name, ulong expected)
        {
            Assert.Equal(expected, CityHash.Hash64(name));
        }

        [Fact]
        public void AgreesWithPrincipiasOwnHashPastSeveralBlocks()
        {
            Assert.Equal(18038928240012347985UL, CityHash.Hash64(new string('x', 130)));
        }
    }
}
