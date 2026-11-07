using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace GonogoPrincipiaUplink
{
    /// <summary>One body as the game's plugin has it, about its parent.</summary>
    public readonly struct PrincipiaBodyReading
    {
        public PrincipiaBodyReading(int index, string name, double[] state)
        {
            Index = index;
            Name = name;
            State = state;
        }

        public int Index { get; }

        public string Name { get; }

        /// <summary>Position then velocity, six numbers.</summary>
        public double[] State { get; }
    }

    /// <summary>What the game says at one instant, read on the game's thread.</summary>
    public sealed class PrincipiaGameReading
    {
        public double Ut;
        public double InverseRotAngle;
        public string FrameFacts = "";
        public List<PrincipiaBodyReading> Bodies = new List<PrincipiaBodyReading>();
    }

    /// <summary>
    /// Sets the game's plugin beside the private copy's, in the game's log: the bodies at
    /// one instant, and the planetarium rotation at the seed and now. A bad body state or
    /// a rotation that differs is a wrong input to the copy, whatever its arithmetic does.
    /// </summary>
    public sealed class PrincipiaDiagnostic
    {
        private const int MaxRotations = 4096;

        private readonly object _gate = new object();
        private readonly List<KeyValuePair<double, double>> _rotations = new List<KeyValuePair<double, double>>();
        private PrincipiaGameReading? _latest;

        /// <summary>Takes a reading. Called on the game's thread.</summary>
        public void Adopt(PrincipiaGameReading reading)
        {
            lock (_gate)
            {
                _latest = reading;
                if (_rotations.Count == 0 || _rotations[_rotations.Count - 1].Value != reading.InverseRotAngle
                    || reading.Ut - _rotations[_rotations.Count - 1].Key > 60.0)
                {
                    _rotations.Add(new KeyValuePair<double, double>(reading.Ut, reading.InverseRotAngle));
                    if (_rotations.Count > MaxRotations)
                    {
                        _rotations.RemoveAt(0);
                    }
                }
            }
        }

        /// <summary>The rotation the game had at or just before <paramref name="ut"/>, or null if none was seen.</summary>
        public double? RotationAt(double ut)
        {
            lock (_gate)
            {
                for (var i = _rotations.Count - 1; i >= 0; i--)
                {
                    if (_rotations[i].Key <= ut)
                    {
                        return _rotations[i].Value;
                    }
                }
                return null;
            }
        }

        /// <summary>Runs the comparison over <paramref name="channel"/> and writes it to <paramref name="log"/>.</summary>
        public void Compare(
            IPrincipiaWorkerChannel channel,
            string library,
            string directory,
            string system,
            double seedUt,
            Action<string> log)
        {
            PrincipiaGameReading? reading;
            lock (_gate)
            {
                reading = _latest;
            }
            if (reading == null)
            {
                log("Principia diagnostic: nothing read from the game yet");
                return;
            }

            log("Principia diagnostic: " + reading.FrameFacts
                + " rotation now " + Number(reading.InverseRotAngle) + " deg at UT " + Number(reading.Ut)
                + ", at seed UT " + Number(seedUt) + " " + (RotationAt(seedUt) is double then ? Number(then) + " deg" : "not seen")
                + ", in the copy's system line " + FirstLineEnd(system) + " deg");

            var indices = new StringBuilder();
            foreach (var body in reading.Bodies)
            {
                if (indices.Length > 0) indices.Append(',');
                indices.Append(body.Index.ToString(CultureInfo.InvariantCulture));
            }
            var reply = channel.Exchange(
                "D\t" + library + "\t" + directory + "\t" + Number(reading.Ut) + "\t" + indices + "\n" + system);
            var text = PrincipiaWorkerProcess.PlainStringField(reply, "points");
            if (text == null)
            {
                log("Principia diagnostic: the copy gave no body states: " + reply);
                return;
            }
            foreach (var line in Lines(text, reading))
            {
                log("Principia diagnostic: " + line);
            }
        }

        /// <summary>One line per body: how far apart the two plugins have it, and the angle between them about its parent.</summary>
        internal static IEnumerable<string> Lines(string points, PrincipiaGameReading reading)
        {
            foreach (var row in points.Split(';'))
            {
                var cells = row.Split(',');
                if (cells.Length != 7) continue;
                var index = int.Parse(cells[0], CultureInfo.InvariantCulture);
                var copy = new double[6];
                for (var i = 0; i < 6; i++)
                {
                    copy[i] = double.Parse(cells[i + 1], CultureInfo.InvariantCulture);
                }
                foreach (var game in reading.Bodies)
                {
                    if (game.Index != index) continue;
                    var g = game.State;
                    var dq = Distance(g[0] - copy[0], g[1] - copy[1], g[2] - copy[2]);
                    var dp = Distance(g[3] - copy[3], g[4] - copy[4], g[5] - copy[5]);
                    var dr = Distance(g[0], g[1], g[2]) - Distance(copy[0], copy[1], copy[2]);
                    var angle = (Math.Atan2(copy[1], copy[0]) - Math.Atan2(g[1], g[0])) * 180.0 / Math.PI;
                    yield return game.Name + " at UT " + Number(reading.Ut)
                        + ": position apart " + Number(dq) + " m, velocity apart " + Number(dp)
                        + " m/s, radius differs " + Number(dr) + " m, copy minus game about the parent "
                        + Number(angle) + " deg. Game " + Join(g) + ". Copy " + Join(copy);
                }
            }
        }

        private static string FirstLineEnd(string system)
        {
            var end = system.IndexOf('\n');
            var line = end < 0 ? system : system.Substring(0, end);
            return line.Substring(line.LastIndexOf('\t') + 1);
        }

        private static double Distance(double x, double y, double z) => Math.Sqrt((x * x) + (y * y) + (z * z));

        private static string Join(double[] values)
        {
            var parts = new string[values.Length];
            for (var i = 0; i < values.Length; i++)
            {
                parts[i] = Number(values[i]);
            }
            return string.Join(",", parts);
        }

        private static string Number(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    }
}
