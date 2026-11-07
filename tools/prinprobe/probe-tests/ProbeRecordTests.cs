using System.Collections.Generic;
using System.Text.Json;
using GonogoPrinProbe;
using Xunit;

namespace GonogoPrinProbe.Tests
{
    public class ProbeRecordTests
    {
        [Fact]
        public void AFlownLineIsJsonAndKeepsEveryDoubleExactly()
        {
            var line = new FlownLine
            {
                Ut = 1861.9799999985967,
                PluginUt = 1861.9799999985967,
                Rotation = 230.0,
                Packed = true,
                Parent = 1,
                Q = new Triple(254789.4456123456789, -705319.58440000001, 1.4877),
                P = new Triple(2041.0212345678901, 737.48, 0.00487),
                Mu = 3.5316e12,
            };
            line.Bodies.Add(new KeyValuePair<int, (Triple, Triple)>(
                2, (new Triple(9568070.68012894, -7363223.13997547, 0.032925145386050056), new Triple(1, 2, 3))));

            using var json = JsonDocument.Parse(ProbeRecord.Flown(line));
            var root = json.RootElement;
            Assert.Equal("flown", root.GetProperty("kind").GetString());
            Assert.Equal(line.Ut, root.GetProperty("ut").GetDouble());
            Assert.Equal(line.Q.X, root.GetProperty("q")[0].GetDouble());
            Assert.Equal(line.P.X, root.GetProperty("p")[0].GetDouble());
            Assert.Equal(0.032925145386050056, root.GetProperty("bodies").GetProperty("2").GetProperty("q")[2].GetDouble());
            Assert.True(root.GetProperty("packed").GetBoolean());
        }

        [Fact]
        public void TheSeedNamesItsRotationBesideTheState()
        {
            using var json = JsonDocument.Parse(ProbeRecord.Seed(100.5, 1, 320.00735054409353, new Triple(1, 2, 3), new Triple(4, 5, 6)));
            Assert.Equal(320.00735054409353, json.RootElement.GetProperty("rotation").GetDouble());
            Assert.Equal(6.0, json.RootElement.GetProperty("p")[2].GetDouble());
        }

        [Fact]
        public void AFactSurvivesQuotesAndNewlines()
        {
            using var json = JsonDocument.Parse(ProbeRecord.Fact("node", "a \"b\"\n{ c = d }\\"));
            Assert.Equal("a \"b\"\n{ c = d }\\", json.RootElement.GetProperty("value").GetString());
        }

        [Fact]
        public void AWorldVectorSwapsItsYAndZForThePlanetariumFrame()
        {
            var v = new Triple(1, 2, 3).WorldToPlanetarium();
            Assert.Equal((1.0, 3.0, 2.0), (v.X, v.Y, v.Z));
        }
    }
}
