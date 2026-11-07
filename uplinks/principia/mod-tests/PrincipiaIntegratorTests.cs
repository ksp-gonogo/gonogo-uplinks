using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using Sitrep.Contract;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// The accurate answer to propagate-from-state, up to and through the worker. The
    /// real-build test runs the shipped native half against a real <c>principia.so</c> when
    /// <c>PRINCIPIA_SO</c> names one, and passes silently where none exists, on the
    /// same terms as the other real-binary tests here.
    /// </summary>
    public class PrincipiaIntegratorTests
    {
        private const double Mu = 3.5316e12;

        private static readonly PropagationSeed Seed = new PropagationSeed(
            new StateVector(new Vector3d(700_000.0, 0.0, 0.0), new Vector3d(0.0, 2246.0, 0.0)), 1, 100.0, Mu);

        private static PrincipiaWorkerDecision MayRun =>
            PrincipiaWorkerDecision.Run(PrincipiaNumericsProvenance.Reproduced, "same machine");

        private sealed class FakeChannel : IPrincipiaWorkerChannel
        {
            public readonly List<string> Requests = new List<string>();
            public readonly Queue<string?> Replies = new Queue<string?>();
            public ManualResetEventSlim? Gate;
            public bool Disposed;

            public string? Exchange(string request)
            {
                Requests.Add(request);
                Gate?.Wait();
                return Replies.Count > 0 ? Replies.Dequeue() : null;
            }

            public void Dispose() => Disposed = true;
        }

        private const string GoodReply =
            "{\"ok\": true, \"fromUt\": 100.0, \"reachedUt\": 200.0, "
            + "\"points\": \"100.0,700000.0,0.0,0.0,0.0,2246.0,0.0;200.0,690000.0,1000.0,0.0,1.0,2.0,3.0\"}";

        private static PrincipiaIntegrator Integrator(params IPrincipiaWorkerChannel?[] channels)
        {
            var queue = new Queue<IPrincipiaWorkerChannel?>(channels);
            var integrator = new PrincipiaIntegrator(
                () => queue.Count > 0 ? queue.Dequeue() : null, () => "S\nB\t0\t\nB\t1\t0\n");
            integrator.Authorise("/lib/principia.so", "Levi-Civita", MayRun);
            return integrator;
        }

        [Fact]
        public void ABuildThatMayNotRunRefusesWithTheGatesOwnReason()
        {
            var integrator = new PrincipiaIntegrator(() => new FakeChannel(), () => "{}");
            integrator.Authorise(
                null, null, PrincipiaWorkerDecision.Refuse(PrincipiaWorkerRefusal.BuildNotConformant, "not vetted"));

            var path = integrator.Propagate(Seed, 200.0, 8);

            Assert.False(path.Solved);
            Assert.Equal("not vetted", path.Refusal);
        }

        [Fact]
        public void AnAnswerSaysItIsIntegratedAndWhichBuildMadeIt()
        {
            var channel = new FakeChannel();
            channel.Replies.Enqueue(GoodReply);

            var path = Integrator(channel).Propagate(Seed, 200.0, 8);

            Assert.True(path.Solved);
            Assert.Equal(TrajectoryKind.Integrated, path.Kind);
            Assert.Equal(200.0, path.ReachedUt);
            Assert.Equal(1, path.CentreBodyIndex);
            Assert.Equal(2, path.States.Count);
            Assert.Equal(690000.0, path.States[1].X);
            Assert.Contains("Levi-Civita", path.Basis);
        }

        [Fact]
        public void ASlowAnswerNeverHoldsTheCallerAndIsThereForTheNextAsk()
        {
            var channel = new FakeChannel { Gate = new ManualResetEventSlim(false) };
            channel.Replies.Enqueue(GoodReply);
            var integrator = Integrator(channel);

            var first = integrator.Propagate(Seed, 200.0, 8);
            Assert.False(first.Solved);
            Assert.True(first.StillWorking);

            channel.Gate.Set();
            var deadline = Stopwatch.StartNew();
            PropagatedPath next;
            do
            {
                next = integrator.Propagate(Seed, 200.0, 8);
            }
            while (!next.Solved && deadline.ElapsedMilliseconds < 5000);

            Assert.True(next.Solved);
            Assert.Single(channel.Requests);
        }

        [Fact]
        public void AWorkerThatDiesRefusesAndTheNextAskStartsAnother()
        {
            var dead = new FakeChannel();
            var fresh = new FakeChannel();
            fresh.Replies.Enqueue(GoodReply);
            var integrator = Integrator(dead, fresh);

            var first = integrator.Propagate(Seed, 200.0, 8);
            Assert.False(first.Solved);
            Assert.Contains("stopped", first.Refusal);
            Assert.True(dead.Disposed);

            Assert.True(integrator.Propagate(Seed, 200.0, 8).Solved);
        }

        [Fact]
        public void AStateNoCraftCanBeInNeverReachesTheCopy()
        {
            var channel = new FakeChannel();
            var integrator = Integrator(channel);
            var zero = new PropagationSeed(new StateVector(default, default), 1, 100.0, Mu);
            var nan = new PropagationSeed(
                new StateVector(new Vector3d(double.NaN, 0, 0), new Vector3d(0, 1, 0)), 1, 100.0, Mu);
            var unknownBody = new PropagationSeed(Seed.State, 99, 100.0, Mu);

            Assert.False(integrator.Propagate(zero, 200.0, 8).Solved);
            Assert.False(integrator.Propagate(nan, 200.0, 8).Solved);
            Assert.False(integrator.Propagate(unknownBody, 200.0, 8).Solved);

            Assert.Empty(channel.Requests);
        }

        [Fact]
        public void NoWorkerOnThisMachineIsARefusalNotAConic()
        {
            var path = Integrator(new IPrincipiaWorkerChannel?[] { null }).Propagate(Seed, 200.0, 8);

            Assert.False(path.Solved);
            Assert.Equal(TrajectoryKind.Unspecified, path.Kind);
        }

        [Fact]
        public void TheProviderAnswersAnAnalyticAskWithItsConicAndAnAccurateOneWithTheBuild()
        {
            var channel = new FakeChannel();
            channel.Replies.Enqueue(GoodReply);
            var provider = new PrincipiaPropagationProvider(
                new ConicAnswer(),
                () => null,
                _ => new PrincipiaPerturber[0],
                _ => null,
                integrator: Integrator(channel));

            var analytic = provider.PropagateFromState(Seed, 200.0, 8, PropagationCertification.AnalyticAccepted);
            var accurate = provider.PropagateFromState(Seed, 200.0, 8, PropagationCertification.Accurate);

            Assert.Equal(TrajectoryKind.Analytic, analytic.Kind);
            Assert.Empty(channel.Requests.FindAll(r => r.Contains("analytic")));
            Assert.Equal(TrajectoryKind.Integrated, accurate.Kind);
            Assert.Equal(PrincipiaPropagationProvider.ProviderIdValue, accurate.ProviderId);
        }

        [Fact]
        public void AProviderWithNoBuildRefusesAnAccurateAskRatherThanAnsweringWithAConic()
        {
            var provider = new PrincipiaPropagationProvider(
                new ConicAnswer(), () => null, _ => new PrincipiaPerturber[0], _ => null);

            var path = provider.PropagateFromState(Seed, 200.0, 8, PropagationCertification.Accurate);

            Assert.False(path.Solved);
            Assert.Equal(TrajectoryKind.Unspecified, path.Kind);
        }

        private sealed class ConicAnswer : IPropagationProvider
        {
            public string ProviderId => "conic-answer";

            public PropagatedPath PropagateFromState(PropagationSeed seed, double toUt, int maxPoints, PropagationCertification certification) =>
                new PropagatedPath { Solved = true, Kind = TrajectoryKind.Analytic, ReachedUt = toUt };

            public StateVector Solve(PropagationTarget target, PropagationFrame frame, double ut) => default;

            public void SolveMany(PropagationTarget target, PropagationFrame frame, IReadOnlyList<double> uts, StateVector[] into)
            {
            }

            public double? CharacteristicCycleSeconds(PropagationTarget target) => null;

            public RadiusExtremes? RadiusExtremesOf(PropagationTarget target) => null;

            public bool CanPropagate(PropagationTarget target, PropagationFrame frame, double fromUt, double toUt) => true;

            public ClosestApproach? SolveClosestApproach(PropagationTarget subject, PropagationTarget other, PropagationFrame frame, double fromUt, double toUt) => null;
        }

        [Fact]
        public void ASystemIsWrittenWithTheConfigsOwnStringsAndEmptyFieldsForWhatItLacks()
        {
            var system = new PrincipiaWorkerSystem { GameEpoch = "JD1", SolarSystemEpoch = "JD2" };
            system.Bodies.Add(new PrincipiaWorkerBody
            {
                Index = 0,
                Name = "Sun \"A\"",
                GravitationalParameter = "1.5 m^3/s^2",
            });
            system.Bodies.Add(new PrincipiaWorkerBody
            {
                Index = 1,
                ParentIndex = 0,
                Name = "B",
                GravitationalParameter = "2 km^3/s^2",
                Elements = new PrincipiaWorkerElements { Eccentricity = 0.25 },
            });

            var text = system.ToText();

            Assert.StartsWith("S\tJD1\tJD2\t0\n", text);
            Assert.Contains("\nB\t1\t0\tB\t2 km^3/s^2\t", text);
            Assert.Contains("B\t0\t\tSun \"A\"\t", text);
            Assert.Contains("\nE\t0.25\t", text);
        }

        [Fact]
        public void TheRealBuildIntegratesInsideThisProcess() => TheRealBuildIntegrates(PrincipiaPrivateCopy.Open);

        [Fact]
        public void TheRealBuildIntegratesInASeparateProcess() => TheRealBuildIntegrates(PrincipiaPrivateCopy.OpenSeparateProcess);

        private static void TheRealBuildIntegrates(Func<string, IPrincipiaWorkerChannel?> route)
        {
            var library = Environment.GetEnvironmentVariable("PRINCIPIA_SO");
            if (string.IsNullOrEmpty(library) || !File.Exists(library))
            {
                Console.WriteLine("Skipped: set PRINCIPIA_SO to a principia.so, with its libc++ beside it on LD_LIBRARY_PATH.");
                return;
            }

            var directory = Path.Combine(Path.GetTempPath(), "gonogo-principia-test");
            Directory.CreateDirectory(directory);
            var system = new PrincipiaWorkerSystem { GameEpoch = "JD2451545", SolarSystemEpoch = "JD2451545" };
            system.Bodies.Add(new PrincipiaWorkerBody
            {
                Index = 0,
                Name = "Sun",
                GravitationalParameter = "1.1723328e18 m^3/s^2",
                ReferenceInstant = "JD2451545.0",
                MinRadius = "261600000 m",
                MeanRadius = "261600000 m",
                MaxRadius = "261600000 m",
                AtmosphereDepth = "0 m",
                AxisRightAscension = "-90 deg",
                AxisDeclination = "90 deg",
                ReferenceAngle = "0 deg",
                AngularFrequency = "1.2e-6 rad/s",
            });
            system.Bodies.Add(new PrincipiaWorkerBody
            {
                Index = 1,
                ParentIndex = 0,
                Name = "Kerbin",
                GravitationalParameter = "3.5316e12 m^3/s^2",
                ReferenceInstant = "JD2451545.0",
                MinRadius = "600000 m",
                MeanRadius = "600000 m",
                MaxRadius = "600000 m",
                AtmosphereDepth = "70000 m",
                AxisRightAscension = "-90 deg",
                AxisDeclination = "90 deg",
                ReferenceAngle = "90 deg",
                AngularFrequency = "2.9e-4 rad/s",
                Elements = new PrincipiaWorkerElements
                {
                    MeanMotion = Math.Sqrt(1.1723328e18 / Math.Pow(13599840256.0, 3.0)),
                    MeanAnomaly = 3.14,
                },
            });

            var force = 0;
            var logged = new List<string>();
            var integrator = new PrincipiaIntegrator(
                () => route(directory), system.ToText, directory, () => force-- > 0, logged.Add);
            integrator.Authorise(library, "test build", MayRun);
            var seed = new PropagationSeed(
                new StateVector(new Vector3d(700_000.0, 0.0, 0.0), new Vector3d(0.0, Math.Sqrt(Mu / 700_000.0), 0.0)),
                1,
                0.0,
                Mu);

            var deadline = Stopwatch.StartNew();
            PropagatedPath path;
            do
            {
                path = integrator.Propagate(seed, 1000.0, 16);
            }
            while (!path.Solved && path.StillWorking && deadline.ElapsedMilliseconds < 60000);

            Assert.True(path.Solved, path.Refusal);
            Assert.Equal(TrajectoryKind.Integrated, path.Kind);
            Assert.Equal(1000.0, path.ReachedUt!.Value, 3);
            Assert.Equal(700_000.0, path.States[0].X, 3);
            Assert.Equal(0.0, path.States[0].Y, 3);

            // A quarter of an orbit carries the craft from +x towards +y in the seed's own axes.
            var period = 2 * Math.PI * Math.Sqrt(Math.Pow(700_000.0, 3.0) / Mu);
            var expectedAngle = 2 * Math.PI * 1000.0 / period;
            var last = path.States[path.States.Count - 1];
            var offX = last.X - (700_000.0 * Math.Cos(expectedAngle));
            var offY = last.Y - (700_000.0 * Math.Sin(expectedAngle));
            Assert.True(Math.Sqrt((offX * offX) + (offY * offY) + (last.Z * last.Z)) < 500.0);

            // A fatal check in the copy leaves this process running and the next ask answered.
            force = 1;
            var later = new PropagationSeed(seed.State, 1, 2000.0, Mu);
            deadline.Restart();
            do
            {
                path = integrator.Propagate(later, 3000.0, 16);
            }
            while (!path.Solved && path.StillWorking && deadline.ElapsedMilliseconds < 60000);
            if (!path.Solved)
            {
                // The separate route loses its process to the check, and the next ask starts another.
                path = integrator.Propagate(later, 3000.0, 16);
                deadline.Restart();
                while (!path.Solved && deadline.ElapsedMilliseconds < 60000)
                {
                    path = integrator.Propagate(later, 3000.0, 16);
                }
            }
            Assert.True(path.Solved, path.Refusal);
        }

        [Fact]
        public void ACaughtFailureLeavesALineAnOperatorCanFind()
        {
            var channel = new FakeChannel();
            channel.Replies.Enqueue("{\"ok\": false, \"caught\": true, \"reason\": \"a fatal check was caught\"}");
            var logged = new List<string>();
            var integrator = new PrincipiaIntegrator(
                () => channel, () => "S\nB\t1\t0\n", "", null, logged.Add);
            integrator.Authorise("/lib/principia.so", "Levi-Civita", MayRun);

            var path = integrator.Propagate(Seed, 200.0, 8);

            Assert.False(path.Solved);
            Assert.Contains(logged, line => line.Contains("a fatal check was caught"));
        }
    }
}
