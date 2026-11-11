using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Threading;
using Sitrep.Contract;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// Integrates from a given state by asking a private copy of the player's own
    /// Principia build, inside the game's process.
    ///
    /// <para><b>A caller is never held for long.</b> Catching a large solar system up to
    /// a seed can take seconds and the caller may be the thread that carries telemetry,
    /// so the exchange runs on a thread of its own. An ask that does not finish within
    /// <see cref="WaitMilliseconds"/> is refused with a sentence saying to ask again, and
    /// the answer is held for that next ask.</para>
    /// </summary>
    public sealed class PrincipiaIntegrator
    {
        /// <summary>How long a caller waits for an answer before being told to ask again.</summary>
        public const int WaitMilliseconds = 250;

        /// <summary>The most points one path carries. Each is a step of the private plugin.</summary>
        public const int MaxPoints = 1024;

        /// <summary>The furthest one path reaches, in seconds: longer than any widget asks, short of what a long catch-up would cost.</summary>
        public const double MaxSpanSeconds = 30 * 86400.0;

        /// <summary>What a stopped copy tells an asker and the Uplink's roster entry.</summary>
        public const string StoppedSentence =
            "Principia's forecasts stopped after an internal error. Restart the game to bring them back.";

        /// <summary>Why forecasts stopped for this session, or null while they run.</summary>
        public string? StoppedReason { get; private set; }

        private bool _reportedBuild;

        private const string Catching =
            "Principia is still catching up to that instant. Ask again shortly.";

        private readonly Func<IPrincipiaWorkerChannel?> _spawn;
        private readonly Func<string?> _system;
        private readonly string _directory;
        private readonly Func<bool> _forceCheck;
        private readonly Action<UplinkLogLevel, string> _log;
        private readonly PrincipiaDiagnostic? _diagnostic;
        private readonly object _gate = new object();
        private readonly object _channelGate = new object();

        private string? _libraryPath;
        private string? _basis;
        private string? _refusal = "Principia's build has not been checked yet.";
        private IPrincipiaWorkerChannel? _channel;
        private string? _systemJson;
        private string? _runningKey;
        private string? _heldKey;
        private PropagatedPath? _held;
        private ManualResetEventSlim? _finished;

        /// <param name="spawn">Opens the private copy, or returns null where it cannot run.</param>
        /// <param name="system">The solar system as text, or null when it cannot be read yet.</param>
        /// <param name="directory">Where the temporary file of the copy may be written.</param>
        /// <param name="log">Where a caught failure in the copy is written so an operator can find it.</param>
        /// <param name="forceCheck">
        /// True when the next ask should first force a fatal check in the copy, so recovery
        /// can be exercised in the real game. Null never forces one.
        /// </param>
        public PrincipiaIntegrator(
            Func<IPrincipiaWorkerChannel?> spawn,
            Func<string?> system,
            string directory = "",
            Func<bool>? forceCheck = null,
            Action<UplinkLogLevel, string>? log = null,
            PrincipiaDiagnostic? diagnostic = null,
            Func<double, PrincipiaFrameAt?>? frameAt = null)
        {
            _spawn = spawn ?? throw new ArgumentNullException(nameof(spawn));
            _system = system ?? throw new ArgumentNullException(nameof(system));
            _directory = directory;
            _forceCheck = forceCheck ?? (() => false);
            _log = log ?? ((_, _) => { });
            _diagnostic = diagnostic;
            _frameAt = frameAt;
        }

        /// <summary>The game's frame at an instant, or null where none was recorded.</summary>
        private readonly Func<double, PrincipiaFrameAt?>? _frameAt;

        /// <summary>
        /// Takes the conformance gate's answer. Until a build has passed and the decision
        /// says a worker may run, every ask is refused with the decision's reason.
        /// </summary>
        public void Authorise(string? libraryPath, string? releaseName, PrincipiaWorkerDecision decision)
        {
            lock (_gate)
            {
                if (StoppedReason != null)
                {
                    return;
                }
                _libraryPath = libraryPath;
                if (!decision.MayRun || string.IsNullOrEmpty(libraryPath))
                {
                    _refusal = decision.Reason;
                    return;
                }
                _refusal = null;
                _basis = "Principia " + (releaseName ?? "(unnamed build)") + ", " + DescribeProvenance(decision.Provenance);
            }
        }

        private static string DescribeProvenance(PrincipiaNumericsProvenance provenance)
        {
            switch (provenance)
            {
                case PrincipiaNumericsProvenance.Reproduced: return "the game's own arithmetic";
                case PrincipiaNumericsProvenance.ReproducedExceptTrig: return "the game's own arithmetic, trigonometry not confirmed";
                default: return "an independent estimate";
            }
        }

        /// <summary>The path from <paramref name="seed"/>, or a refusal saying why there is none.</summary>
        public PropagatedPath Propagate(PropagationSeed seed, double toUt, int maxPoints)
        {
            if (!(toUt > seed.Ut) || double.IsInfinity(toUt) || double.IsNaN(seed.Ut))
            {
                return PropagatedPath.Refused("The path has to end after the state it starts from.");
            }
            if (!Sane(seed))
            {
                return PropagatedPath.Refused("That state is not one a craft can be in.");
            }

            var count = maxPoints > 0 ? Math.Min(maxPoints, MaxPoints) : PropagatedPath.DefaultPoints;
            toUt = Math.Min(toUt, seed.Ut + MaxSpanSeconds);
            var key = Key(seed, toUt, count);
            ManualResetEventSlim finished;
            lock (_gate)
            {
                if (_refusal != null)
                {
                    return PropagatedPath.Refused(_refusal);
                }
                if (_heldKey == key && _held != null)
                {
                    return TakeHeld();
                }
                if (_runningKey != null)
                {
                    if (_runningKey != key)
                    {
                        return PropagatedPath.Working(Catching);
                    }
                    finished = _finished!;
                }
                else
                {
                    _runningKey = key;
                    finished = _finished = new ManualResetEventSlim(false);
                    var library = _libraryPath!;
                    var basis = _basis;
                    var done = finished;
                    var worker = new Thread(() => Run(key, library, basis, seed, toUt, count, done))
                    {
                        IsBackground = true,
                        Name = "Gonogo Principia integrator",
                    };
                    worker.Start();
                }
            }

            if (!finished.Wait(WaitMilliseconds))
            {
                return PropagatedPath.Working(Catching);
            }
            lock (_gate)
            {
                return _heldKey == key && _held != null
                    ? TakeHeld()
                    : PropagatedPath.Working(Catching);
            }
        }

        /// <summary>A path stays held for the next ask; a refusal is answered once, so asking again tries again.</summary>
        private PropagatedPath TakeHeld()
        {
            var held = _held!;
            if (!held.Solved)
            {
                _held = null;
                _heldKey = null;
            }
            return held;
        }

        /// <summary>Reads the solar system now. Call on the game's thread, where reading it is safe.</summary>
        public void Preload()
        {
            lock (_channelGate)
            {
                _systemJson ??= _system();
            }
        }

        /* The first line of defence: a bad value here is a fatal check in the copy. */
        private static bool Sane(PropagationSeed seed)
        {
            var p = seed.State.Position;
            var v = seed.State.Velocity;
            return seed.ParentBodyIndex >= 0
                && Finite(p.X) && Finite(p.Y) && Finite(p.Z)
                && Finite(v.X) && Finite(v.Y) && Finite(v.Z)
                && p.Magnitude() > 0.0;
        }

        private static bool Finite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);

        private void Run(
            string key,
            string library,
            string? basis,
            PropagationSeed seed,
            double toUt,
            int count,
            ManualResetEventSlim finished)
        {
            PropagatedPath path;
            try
            {
                path = Exchange(library, basis, seed, toUt, count);
            }
            catch (Exception)
            {
                DropChannel();
                Stop("talking to the copy failed", null, seed);
                path = PropagatedPath.Refused(StoppedSentence);
            }

            lock (_gate)
            {
                _held = path;
                _heldKey = key;
                _runningKey = null;
            }
            finished.Set();
        }

        private PropagatedPath Exchange(string library, string? basis, PropagationSeed seed, double toUt, int count)
        {
            lock (_channelGate)
            {
                var system = _systemJson ??= _system();
                if (system == null)
                {
                    return PropagatedPath.Refused("The solar system could not be read for Principia yet.");
                }

                if (!system.Contains("\nB\t" + seed.ParentBodyIndex.ToString(CultureInfo.InvariantCulture) + "\t"))
                {
                    return PropagatedPath.Refused("That state is about a body this solar system does not have.");
                }

                var channel = _channel ??= _spawn();
                if (channel == null)
                {
                    return PropagatedPath.Refused("Principia's private copy cannot run on this machine.");
                }

                if (_forceCheck())
                {
                    if (Report(channel.Exchange("X\t" + library + "\t" + _directory + "\n"), seed))
                    {
                        return PropagatedPath.Refused(StoppedSentence);
                    }
                }

                PrincipiaFrameAt? frame = null;
                if (_frameAt != null)
                {
                    frame = _frameAt(seed.Ut);
                    if (frame == null)
                    {
                        return PropagatedPath.Refused(
                            "The game's frame at the instant of that state was not recorded, so Principia cannot place it.");
                    }
                }

                var reply = channel.Exchange(Request(library, _directory, system, seed, toUt, count, frame));
                if (reply == null)
                {
                    DropChannel();
                    Stop("the copy ended without answering", null, seed);
                    return PropagatedPath.Refused(StoppedSentence);
                }
                if (Report(reply, seed))
                {
                    return PropagatedPath.Refused(StoppedSentence);
                }
                var path = Parse(reply, seed, CopyRotation(system, frame));
                if (path.Solved && !_reportedBuild)
                {
                    _reportedBuild = true;
                    _log(UplinkLogLevel.Info, "private copy computing paths: " + basis);
                }
                _diagnostic?.Compare(channel, library, _directory, system, seed.Ut, frame?.RotationDegrees, message => _log(UplinkLogLevel.Info, message));
                return path;
            }
        }

        /*
         * A fatal check most likely means this request was wrong, so asking again would
         * fail again, and each copy set aside keeps its threads and heap until the game
         * exits. So the first one ends forecasts for the session.
         */
        private void Stop(string what, string? check, PropagationSeed? seed)
        {
            lock (_gate)
            {
                _refusal = StoppedSentence;
                StoppedReason = StoppedSentence;
                _held = null;
                _heldKey = null;
            }
            _log(
                UplinkLogLevel.Error,
                "private copy: " + what + (string.IsNullOrEmpty(check) ? "" : ": " + check!.Trim())
                    + (seed == null ? "" : ". Asked from UT " + Text(seed.Value.Ut) + ", body "
                        + seed.Value.ParentBodyIndex.ToString(CultureInfo.InvariantCulture)
                        + ", state " + Text(seed.Value.State.Position.X) + "," + Text(seed.Value.State.Position.Y) + ","
                        + Text(seed.Value.State.Position.Z) + "," + Text(seed.Value.State.Velocity.X) + ","
                        + Text(seed.Value.State.Velocity.Y) + "," + Text(seed.Value.State.Velocity.Z))
                    + ". Forecasts are off until the game restarts.");
        }

        private bool Report(string? reply, PropagationSeed? seed)
        {
            if (PrincipiaWorkerProcess.BoolField(reply, "caught") != true)
            {
                return false;
            }
            Stop(
                PrincipiaWorkerProcess.PlainStringField(reply, "reason") ?? "a failure was caught",
                PrincipiaWorkerProcess.PlainStringField(reply, "check"),
                seed);
            return true;
        }

        private void DropChannel()
        {
            lock (_channelGate)
            {
                _channel?.Dispose();
                _channel = null;
            }
        }

        private static string Key(PropagationSeed seed, double toUt, int count)
        {
            var p = seed.State.Position;
            var v = seed.State.Velocity;
            return string.Join(
                "|",
                new[]
                {
                    Text(seed.Ut), Text(toUt), count.ToString(CultureInfo.InvariantCulture),
                    seed.ParentBodyIndex.ToString(CultureInfo.InvariantCulture),
                    Text(p.X), Text(p.Y), Text(p.Z), Text(v.X), Text(v.Y), Text(v.Z),
                });
        }

        private static string Text(double value) => PrincipiaWorkerSystem.Number(value);

        internal static string Request(
            string library, string directory, string system, PropagationSeed seed, double toUt, int count,
            PrincipiaFrameAt? frame = null)
        {
            // The copy's states are in the game's frame turned about the pole by the rotation
            // the copy is built at; the seed, from the game's orbital elements, is not.
            var into = -CopyRotation(system, frame);
            var p = AboutPole(seed.State.Position, into);
            var v = AboutPole(seed.State.Velocity, into);
            return string.Join(
                "\t",
                new[]
                {
                    "P", library, Text(seed.Ut), seed.ParentBodyIndex.ToString(CultureInfo.InvariantCulture),
                    Text(p.X), Text(p.Y), Text(p.Z), Text(v.X), Text(v.Y), Text(v.Z),
                    Text(toUt), count.ToString(CultureInfo.InvariantCulture), directory,
                    frame is { } at ? Text(at.RotationDegrees) : "-",
                    frame is { } on ? on.MainBody.ToString(CultureInfo.InvariantCulture) : "-",
                })
                + "\n" + system;
        }

        /// <summary>
        /// The rotation the copy is built at for an ask, in degrees: the game's at the seed
        /// when it is known, else the one the system was read with, as the native side does.
        /// </summary>
        internal static double CopyRotation(string system, PrincipiaFrameAt? frame)
        {
            if (frame is { } at)
            {
                return at.RotationDegrees;
            }
            var end = system.IndexOf('\n');
            var first = end < 0 ? system : system.Substring(0, end);
            var field = first.Substring(first.LastIndexOf('\t') + 1);
            return double.TryParse(field, NumberStyles.Float, CultureInfo.InvariantCulture, out var degrees) ? degrees : 0.0;
        }

        /// <summary>A vector turned about the pole, which is z in these axes, by an angle in degrees.</summary>
        internal static Sitrep.Contract.Vector3d AboutPole(Sitrep.Contract.Vector3d v, double degrees)
        {
            var radians = degrees * Math.PI / 180.0;
            var cos = Math.Cos(radians);
            var sin = Math.Sin(radians);
            return new Sitrep.Contract.Vector3d((v.X * cos) - (v.Y * sin), (v.X * sin) + (v.Y * cos), v.Z);
        }

        internal static PropagatedPath Parse(string reply, PropagationSeed seed, double rotationDegrees = 0.0)
        {
            if (PrincipiaWorkerProcess.BoolField(reply, "ok") != true)
            {
                return PropagatedPath.Refused(
                    PrincipiaWorkerProcess.PlainStringField(reply, "reason") ?? "Principia could not integrate from that state.");
            }

            var reached = PrincipiaWorkerProcess.NumberField(reply, "reachedUt");
            var text = PrincipiaWorkerProcess.PlainStringField(reply, "points");
            if (reached == null || string.IsNullOrEmpty(text))
            {
                return PropagatedPath.Refused("Principia returned no path from that state.");
            }

            var states = new List<BodyState>();
            foreach (var row in text!.Split(';'))
            {
                var cells = row.Split(',');
                if (cells.Length != 7)
                {
                    return PropagatedPath.Refused("Principia returned a path that could not be read.");
                }
                var values = new double[7];
                for (var i = 0; i < 7; i++)
                {
                    if (!double.TryParse(cells[i], NumberStyles.Float, CultureInfo.InvariantCulture, out values[i]))
                    {
                        return PropagatedPath.Refused("Principia returned a path that could not be read.");
                    }
                }
                // Back out of the copy's turned frame into the fixed frame the seed came in.
                var position = AboutPole(new Sitrep.Contract.Vector3d(values[1], values[2], values[3]), rotationDegrees);
                var velocity = AboutPole(new Sitrep.Contract.Vector3d(values[4], values[5], values[6]), rotationDegrees);
                states.Add(new BodyState
                {
                    Ut = values[0],
                    X = position.X,
                    Y = position.Y,
                    Z = position.Z,
                    Vx = velocity.X,
                    Vy = velocity.Y,
                    Vz = velocity.Z,
                });
            }

            return new PropagatedPath
            {
                Solved = true,
                Kind = TrajectoryKind.Integrated,
                CentreBodyIndex = seed.ParentBodyIndex,
                States = states,
                ReachedUt = reached,
            };
        }
    }
}
