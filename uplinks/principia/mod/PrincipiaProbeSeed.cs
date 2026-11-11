using System;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Sitrep.Contract;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// A development seed: the game's own Principia state for the active craft at one
    /// instant, written by a measuring instrument beside the native half. While the file is
    /// there, every accurate ask starts from it instead of from what the command centre
    /// heard, so the private copy can be compared with the game's own Principia from an
    /// identical state. With no file, nothing changes. The state handed on is in KSP's
    /// fixed frame, the same frame as a seed built from orbital elements.
    ///
    /// <para>The file holds the state about the parent in Principia's planetarium frame and
    /// the rotation it was read under:
    /// <c>{"ut":…,"parent":1,"rotation":230,"q":[x,y,z],"p":[x,y,z]}</c>.</para>
    /// </summary>
    public static class PrincipiaProbeSeed
    {
        /// <summary>The seed file's name, beside the native half.</summary>
        public const string FileName = "prinprobe-seed.json";

        /// <summary>
        /// The accurate ask, answered by <paramref name="ask"/> from the seed file's state
        /// while there is one (<paramref name="seedFile"/> is its text), and from
        /// <paramref name="seed"/> otherwise. A solved path from the file goes to <paramref name="written"/>.
        /// </summary>
        public static PropagatedPath Around(
            string? seedFile,
            PropagationSeed seed,
            double toUt,
            Func<PropagationSeed, double, PropagatedPath> ask,
            Action<double, string> written)
        {
            var text = seedFile;
            if (text == null)
            {
                return ask(seed, toUt);
            }
            var replaced = Replace(text, seed, toUt);
            if (replaced == null)
            {
                return PropagatedPath.Refused("The development seed file could not be read.");
            }
            var path = ask(replaced.Value.Seed, replaced.Value.ToUt);
            if (path.Solved)
            {
                written(replaced.Value.Seed.Ut, PathLines(path));
            }
            return path;
        }

        /// <summary>
        /// The asked seed replaced by the file's, in the fixed frame, keeping the span the
        /// asker wanted. Null when the text is not a seed.
        /// </summary>
        public static (PropagationSeed Seed, double ToUt)? Replace(string text, PropagationSeed asked, double toUt)
        {
            var ut = Scalar(text, "ut");
            var parent = Scalar(text, "parent");
            var rotation = Scalar(text, "rotation");
            var q = Triple(text, "q");
            var p = Triple(text, "p");
            if (ut == null || parent == null || rotation == null || q == null || p == null)
            {
                return null;
            }
            var state = new StateVector(
                ToFixed(q.Value, rotation.Value),
                ToFixed(p.Value, rotation.Value));
            var seed = new PropagationSeed(state, (int)parent.Value, ut.Value, asked.Mu);
            return (seed, ut.Value + (toUt - asked.Ut));
        }

        /// <summary>A solved path as JSON lines, one state each, fixed frame, about <see cref="PropagatedPath.CentreBodyIndex"/>.</summary>
        public static string PathLines(PropagatedPath path)
        {
            var text = new StringBuilder();
            foreach (var s in path.States)
            {
                text.Append("{\"ut\":").Append(Number(s.Ut))
                    .Append(",\"centre\":").Append(path.CentreBodyIndex.ToString(CultureInfo.InvariantCulture))
                    .Append(",\"q\":[").Append(Number(s.X)).Append(',').Append(Number(s.Y)).Append(',').Append(Number(s.Z))
                    .Append("],\"p\":[").Append(Number(s.Vx)).Append(',').Append(Number(s.Vy)).Append(',').Append(Number(s.Vz))
                    .Append("]}\n");
            }
            return text.ToString();
        }

        /* KSP's Planetarium.Zup has its X axis at (cos r, sin r, 0), so fixed = Rz(+r) · planetarium. */
        private static Sitrep.Contract.Vector3d ToFixed(Sitrep.Contract.Vector3d v, double degrees)
        {
            var radians = degrees * Math.PI / 180.0;
            var cos = Math.Cos(radians);
            var sin = Math.Sin(radians);
            return new Sitrep.Contract.Vector3d((cos * v.X) - (sin * v.Y), (sin * v.X) + (cos * v.Y), v.Z);
        }

        private static string Number(double value) => value.ToString("R", CultureInfo.InvariantCulture);

        private static double? Scalar(string text, string field)
        {
            var match = Regex.Match(text, "\"" + Regex.Escape(field) + "\"\\s*:\\s*([-+0-9.eE]+)");
            return match.Success
                && double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
                ? value
                : (double?)null;
        }

        private static Sitrep.Contract.Vector3d? Triple(string text, string field)
        {
            var match = Regex.Match(text, "\"" + Regex.Escape(field) + "\"\\s*:\\s*\\[([^\\]]*)\\]");
            if (!match.Success)
            {
                return null;
            }
            var cells = match.Groups[1].Value.Split(',');
            if (cells.Length != 3)
            {
                return null;
            }
            var values = new double[3];
            for (var i = 0; i < 3; i++)
            {
                if (!double.TryParse(cells[i].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out values[i]))
                {
                    return null;
                }
            }
            return new Sitrep.Contract.Vector3d(values[0], values[1], values[2]);
        }
    }
}
