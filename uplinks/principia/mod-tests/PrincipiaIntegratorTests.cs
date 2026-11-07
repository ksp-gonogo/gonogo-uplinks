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
        public void TheFirstFailureStopsForecastsForTheSessionAndSaysSo()
        {
            var dead = new FakeChannel();
            var unused = new FakeChannel();
            unused.Replies.Enqueue(GoodReply);
            var logged = new List<string>();
            var queue = new Queue<IPrincipiaWorkerChannel?>(new IPrincipiaWorkerChannel?[] { dead, unused });
            var integrator = new PrincipiaIntegrator(
                () => queue.Dequeue(), () => "S\nB\t0\t\nB\t1\t0\n", "", null, (_, m) => logged.Add(m));
            integrator.Authorise("/lib/principia.so", "Levi-Civita", MayRun);

            var first = integrator.Propagate(Seed, 200.0, 8);
            var again = integrator.Propagate(Seed, 300.0, 8);

            Assert.False(first.Solved);
            Assert.False(again.Solved);
            Assert.False(again.StillWorking);
            Assert.Empty(unused.Requests);
            Assert.Equal(PrincipiaIntegrator.StoppedSentence, integrator.StoppedReason);
            Assert.Contains(logged, line => line.Contains("UT 100"));
        }

        /// <summary>A field of a request's first line.</summary>
        private static string Field(string request, int index) => request.Split('\n')[0].Split('\t')[index];

        private static double RotationField(string request) =>
            double.Parse(Field(request, 13), System.Globalization.CultureInfo.InvariantCulture);

        [Fact]
        public void EachAskGivesTheCopyTheFrameTheGameHadAtItsSeed()
        {
            // The copy was built when the frame stood at 320.0003 degrees; the game's frame
            // turns with Kerbin below the threshold, so each seed has an angle of its own.
            var frame = new PrincipiaGameFrame();
            for (var ut = 0.0; ut <= 4000.0; ut += 1.0)
            {
                frame.Adopt(ut, (320.0003 + (ut * 360.0 / 21600.0)) % 360.0, 1);
            }
            var channel = new FakeChannel();
            channel.Replies.Enqueue(GoodReply);
            channel.Replies.Enqueue(GoodReply);
            var integrator = new PrincipiaIntegrator(
                () => channel, () => "S\tJD1\tJD2\t320.0003\nB\t1\t0\n", "", null, null, null, frame.At);
            integrator.Authorise("/lib/principia.so", "Levi-Civita", MayRun);

            integrator.Propagate(Seed, 200.0, 8);
            integrator.Propagate(new PropagationSeed(Seed.State, 1, 3700.0, Mu), 3800.0, 8);

            Assert.Equal(2, channel.Requests.Count);
            Assert.Equal(frame.At(Seed.Ut)!.Value.RotationDegrees, RotationField(channel.Requests[0]), 9);
            Assert.Equal(frame.At(3700.0)!.Value.RotationDegrees, RotationField(channel.Requests[1]), 9);
            // The second seed is an hour on, past a whole turn of 360 degrees.
            Assert.Equal((320.0003 + (3700.0 * 360.0 / 21600.0)) % 360.0, RotationField(channel.Requests[1]), 6);
            Assert.Equal("1", Field(channel.Requests[0], 14));
        }

        [Fact]
        public void ASeedFromBeforeAnyRecordedRotationIsRefusedRatherThanPlacedInTheWrongFrame()
        {
            var frame = new PrincipiaGameFrame();
            frame.Adopt(5000.0, 10.0, 1);
            var channel = new FakeChannel();
            channel.Replies.Enqueue(GoodReply);
            var integrator = new PrincipiaIntegrator(
                () => channel, () => "S\tJD1\tJD2\t0\nB\t1\t0\n", "", null, null, null, frame.At);
            integrator.Authorise("/lib/principia.so", "Levi-Civita", MayRun);

            var path = integrator.Propagate(Seed, 200.0, 8);

            Assert.False(path.Solved);
            Assert.Empty(channel.Requests);
            Assert.Null(integrator.StoppedReason);
        }

        [Fact]
        public void AFatalCheckIsLoggedWithItsTextAndTheStateThatCausedIt()
        {
            var channel = new FakeChannel();
            channel.Replies.Enqueue(
                "{\"ok\": false, \"caught\": true, \"reason\": \"a fatal check was caught\", \"check\": \"map_util.hpp:63] Check failed: Map key not found: 999\"}");
            var logged = new List<KeyValuePair<UplinkLogLevel, string>>();
            var integrator = new PrincipiaIntegrator(
                () => channel,
                () => "S\nB\t1\t0\n",
                "",
                null,
                (level, message) => logged.Add(new KeyValuePair<UplinkLogLevel, string>(level, message)));
            integrator.Authorise("/lib/principia.so", "Levi-Civita", MayRun);

            integrator.Propagate(Seed, 200.0, 8);

            var line = Assert.Single(logged);
            Assert.Equal(UplinkLogLevel.Error, line.Key);
            Assert.Contains("Map key not found: 999", line.Value);
            Assert.Contains("UT 100", line.Value);
            Assert.Contains("700000", line.Value);
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
                () => route(directory), system.ToText, directory, () => force-- > 0, (_, message) => logged.Add(message),
                null, _ => new PrincipiaFrameAt(37.5, 1));
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

            // The diagnostic asks the copy where each body is, through the real native half.
            var seen = new PrincipiaDiagnostic();
            var game = new PrincipiaGameReading { Ut = 1500.0 };
            game.Bodies.Add(new PrincipiaBodyReading(1, "Kerbin", new double[6]));
            seen.Adopt(game);
            using (var channel = route(directory))
            {
                seen.Compare(channel!, library!, directory, system.ToText(), 1000.0, 37.5, logged.Add);
            }
            Assert.Contains(logged, line => line.Contains("Kerbin at UT"));

            // A fatal check in the copy leaves this process running, is logged with its
            // text, and ends forecasts for the session.
            force = 1;
            var later = new PropagationSeed(seed.State, 1, 2000.0, Mu);
            path = integrator.Propagate(later, 3000.0, 16);
            deadline.Restart();
            while (path.StillWorking && deadline.ElapsedMilliseconds < 60000)
            {
                path = integrator.Propagate(later, 3000.0, 16);
            }
            Assert.False(path.Solved);
            Assert.Equal(PrincipiaIntegrator.StoppedSentence, integrator.StoppedReason);
            Assert.Contains(logged, line => line.Contains("UT 2000"));
            Assert.Contains(logged, line => line.Contains("Check failed") && line.Contains("UT 2000"));
        }

        [Fact]
        public void TheDiagnosticSetsTheTwoPluginsSideBySide()
        {
            var reading = new PrincipiaGameReading { Ut = 100.0 };
            reading.Bodies.Add(new PrincipiaBodyReading(2, "Mun", new[] { 1000.0, 0, 0, 0, 10.0, 0 }));

            var lines = new List<string>(PrincipiaDiagnostic.Lines("2,0,1000,0,10,0,0", reading));

            var line = Assert.Single(lines);
            Assert.Contains("Mun", line);
            Assert.Contains("copy minus game about the parent 90 deg", line);
        }

        [Fact]
        public void TheRotationAtASeedIsTheOneTheGameHadThen()
        {
            var diagnostic = new PrincipiaDiagnostic();
            diagnostic.Adopt(new PrincipiaGameReading { Ut = 100.0, InverseRotAngle = 1.0 });
            diagnostic.Adopt(new PrincipiaGameReading { Ut = 200.0, InverseRotAngle = 2.0 });

            Assert.Equal(1.0, diagnostic.RotationAt(150.0));
            Assert.Null(diagnostic.RotationAt(50.0));
        }
    }
}
