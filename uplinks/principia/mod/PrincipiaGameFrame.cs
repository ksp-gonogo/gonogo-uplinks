using System;
using System.Collections.Generic;

namespace GonogoPrincipiaUplink
{
    /// <summary>The game's frame at one instant: what Principia needs to read a state the game gave.</summary>
    public readonly struct PrincipiaFrameAt
    {
        public PrincipiaFrameAt(double rotationDegrees, int mainBody)
        {
            RotationDegrees = rotationDegrees;
            MainBody = mainBody;
        }

        /// <summary>The planetarium rotation, in degrees from 0 up to 360.</summary>
        public double RotationDegrees { get; }

        /// <summary>The game's main body, by its index.</summary>
        public int MainBody { get; }
    }

    /// <summary>
    /// The game's frame over time, so the private copy can be given the frame the game had
    /// at a seed's instant. Principia places the game's axes by the planetarium rotation and
    /// the main body, and below the main body's rotating-frame threshold the rotation turns
    /// with that body, so a state read from the game means nothing without both.
    /// </summary>
    public sealed class PrincipiaGameFrame
    {
        /*
         * Kept as the corners of a line through the readings, in degrees that are not
         * wrapped, so a rotation that turns at a steady rate costs two corners however
         * long it runs. A reading off the line, such as the frame starting or stopping to
         * turn, or a new main body, opens a new corner.
         */
        private const int MaxCorners = 4096;

        private const double ToleranceDegrees = 1e-6;

        private readonly struct Corner
        {
            public Corner(double ut, double degrees, int mainBody)
            {
                Ut = ut;
                Degrees = degrees;
                MainBody = mainBody;
            }

            public double Ut { get; }

            public double Degrees { get; }

            public int MainBody { get; }
        }

        private readonly object _gate = new object();
        private readonly List<Corner> _corners = new List<Corner>();
        private double? _slope;

        /// <summary>Takes the game's frame at one instant, its rotation in degrees. Called on the game's thread.</summary>
        public void Adopt(double ut, double degrees, int mainBody)
        {
            if (double.IsNaN(ut) || double.IsInfinity(ut) || double.IsNaN(degrees) || double.IsInfinity(degrees))
            {
                return;
            }
            lock (_gate)
            {
                // Time going back is a revert or a load: what was recorded after it never happened.
                while (_corners.Count > 0 && _corners[_corners.Count - 1].Ut >= ut)
                {
                    _corners.RemoveAt(_corners.Count - 1);
                    _slope = null;
                }
                if (_corners.Count == 0)
                {
                    _corners.Add(new Corner(ut, degrees, mainBody));
                    return;
                }

                var last = _corners[_corners.Count - 1];
                var angle = last.Degrees + Turn(degrees - last.Degrees);
                if (_slope is double slope && _corners.Count >= 2 && last.MainBody == mainBody)
                {
                    var start = _corners[_corners.Count - 2];
                    if (Math.Abs(start.Degrees + (slope * (ut - start.Ut)) - angle) <= ToleranceDegrees)
                    {
                        _corners[_corners.Count - 1] = new Corner(ut, angle, mainBody);
                        return;
                    }
                }
                _slope = last.MainBody == mainBody ? (angle - last.Degrees) / (ut - last.Ut) : (double?)null;
                _corners.Add(new Corner(ut, angle, mainBody));
                if (_corners.Count > MaxCorners)
                {
                    _corners.RemoveAt(0);
                }
            }
        }

        /// <summary>The frame the game had at <paramref name="ut"/>, or null when nothing was recorded that early.</summary>
        public PrincipiaFrameAt? At(double ut)
        {
            lock (_gate)
            {
                if (_corners.Count == 0 || ut < _corners[0].Ut)
                {
                    return null;
                }
                if (_corners.Count == 1)
                {
                    return new PrincipiaFrameAt(Wrap(_corners[0].Degrees), _corners[0].MainBody);
                }
                for (var i = 1; i < _corners.Count; i++)
                {
                    var before = _corners[i - 1];
                    var after = _corners[i];
                    if (ut > after.Ut)
                    {
                        continue;
                    }
                    // Every reading between two corners was taken under the later one's main body.
                    var body = ut > before.Ut ? after.MainBody : before.MainBody;
                    return new PrincipiaFrameAt(
                        Wrap(before.Degrees + ((after.Degrees - before.Degrees) * (ut - before.Ut) / (after.Ut - before.Ut))),
                        body);
                }
                // Past the last reading, which is at most a tick old: carry the last line on.
                var penultimate = _corners[_corners.Count - 2];
                var final = _corners[_corners.Count - 1];
                var degrees = final.MainBody == penultimate.MainBody
                    ? final.Degrees + ((final.Degrees - penultimate.Degrees) * (ut - final.Ut) / (final.Ut - penultimate.Ut))
                    : final.Degrees;
                return new PrincipiaFrameAt(Wrap(degrees), final.MainBody);
            }
        }

        /// <summary>A change of angle as the shortest turn, from -180 up to 180 degrees.</summary>
        private static double Turn(double degrees)
        {
            var turn = degrees % 360.0;
            if (turn > 180.0)
            {
                return turn - 360.0;
            }
            if (turn <= -180.0)
            {
                return turn + 360.0;
            }
            return turn;
        }

        private static double Wrap(double degrees)
        {
            var wrapped = degrees % 360.0;
            return wrapped < 0.0 ? wrapped + 360.0 : wrapped;
        }
    }
}
