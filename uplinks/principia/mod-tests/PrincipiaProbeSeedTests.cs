using System;
using System.Collections.Generic;
using Sitrep.Contract;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    public class PrincipiaProbeSeedTests
    {
        private static readonly PropagationSeed Heard = new PropagationSeed(
            new StateVector(new Vector3d(700_000.0, 0.0, 0.0), new Vector3d(0.0, 2246.0, 0.0)), 1, 100.0, 3.5316e12);

        private const string SeedFile =
            "{\"ut\":1861.9799999985967,\"parent\":1,\"rotation\":90,"
            + "\"q\":[254789.4456,-705319.5844,1.4877],\"p\":[2041.02,737.48,0.00487]}";

        private static PropagatedPath Echo(PropagationSeed from, double until)
        {
            var p = from.State.Position;
            var v = from.State.Velocity;
            return new PropagatedPath
            {
                Solved = true,
                CentreBodyIndex = from.ParentBodyIndex,
                States = new List<BodyState>
                {
                    new BodyState { Ut = from.Ut, X = p.X, Y = p.Y, Z = p.Z, Vx = v.X, Vy = v.Y, Vz = v.Z },
                    new BodyState { Ut = until },
                },
            };
        }

        [Fact]
        public void TheFileReplacesTheHeardSeedTurnedToTheFixedFrameAndKeepsTheSpan()
        {
            var replaced = PrincipiaProbeSeed.Replace(SeedFile, Heard, Heard.Ut + 3600.0)!.Value;

            Assert.Equal(1861.9799999985967, replaced.Seed.Ut);
            Assert.Equal(1861.9799999985967 + 3600.0, replaced.ToUt, 9);
            Assert.Equal(1, replaced.Seed.ParentBodyIndex);
            // A quarter turn: planetarium (x, y) is fixed (−y, x).
            Assert.Equal(705319.5844, replaced.Seed.State.Position.X, 6);
            Assert.Equal(254789.4456, replaced.Seed.State.Position.Y, 6);
            Assert.Equal(1.4877, replaced.Seed.State.Position.Z, 9);
            Assert.Equal(-737.48, replaced.Seed.State.Velocity.X, 9);
        }

        [Fact]
        public void TextThatIsNotASeedIsRefused()
        {
            var path = PrincipiaProbeSeed.Around("{\"ut\":1}", Heard, 200.0, Echo, (_, _) => { });
            Assert.False(path.Solved);
        }

        [Fact]
        public void WithNoFileTheAskIsUntouched()
        {
            var path = PrincipiaProbeSeed.Around(null, Heard, 200.0, Echo, (_, _) => throw new InvalidOperationException());
            Assert.Equal(100.0, path.States[0].Ut);
            Assert.Equal(200.0, path.States[1].Ut);
        }

        [Fact]
        public void WhileTheFileIsThereTheAskStartsFromItAndItsPathIsWrittenOut()
        {
            var written = new List<(double Ut, string Lines)>();
            var path = PrincipiaProbeSeed.Around(SeedFile, Heard, Heard.Ut + 3600.0, Echo, (ut, lines) => written.Add((ut, lines)));

            Assert.Equal(1861.9799999985967, path.States[0].Ut);
            Assert.Equal(705319.5844, path.States[0].X, 6);
            Assert.Single(written);
            Assert.Equal(1861.9799999985967, written[0].Ut);
            Assert.Contains("\"centre\":1", written[0].Lines);
            Assert.Equal(2, written[0].Lines.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length);
        }
    }
}
