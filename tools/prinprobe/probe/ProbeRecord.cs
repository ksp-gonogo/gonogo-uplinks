using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace GonogoPrinProbe
{
    /// <summary>Three doubles, in whatever frame the field that holds them names.</summary>
    public struct Triple
    {
        public double X, Y, Z;

        public Triple(double x, double y, double z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        public static Triple operator -(Triple a, Triple b) => new Triple(a.X - b.X, a.Y - b.Y, a.Z - b.Z);

        public double Length() => Math.Sqrt((X * X) + (Y * Y) + (Z * Z));

        /// <summary>
        /// A Unity world vector as Principia's planetarium frame and KSP's <c>orbit.pos</c>
        /// hold it: the y and z axes swapped.
        /// </summary>
        public Triple WorldToPlanetarium() => new Triple(X, Z, Y);
    }

    /// <summary>One frame of the game's Principia, as numbers.</summary>
    public sealed class FlownLine
    {
        public double Ut;
        public double PluginUt;
        public double Rotation;
        public bool Packed;
        public bool Loaded;
        public int Parent;
        public Triple Q;
        public Triple P;
        public Triple OrbitPos;
        public Triple OrbitVel;
        public double Sma, Ecc, Inc, Lan, ArgPe, MeanAnomalyAtEpoch, Epoch, Mu;
        public List<KeyValuePair<int, (Triple Q, Triple P)>> Bodies = new List<KeyValuePair<int, (Triple, Triple)>>();
    }

    /// <summary>
    /// The probe's output as JSON lines. Every double is written round-trip exact, since
    /// the comparison this feeds is meant to reach floating-point noise.
    /// </summary>
    public static class ProbeRecord
    {
        public static string Number(double value) => value.ToString("R", CultureInfo.InvariantCulture);

        public static string Vector(Triple v) => "[" + Number(v.X) + "," + Number(v.Y) + "," + Number(v.Z) + "]";

        public static string Text(string value)
        {
            var text = new StringBuilder("\"");
            foreach (var c in value)
            {
                if (c == '"' || c == '\\')
                {
                    text.Append('\\').Append(c);
                }
                else if (c < ' ')
                {
                    text.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                }
                else
                {
                    text.Append(c);
                }
            }
            return text.Append('"').ToString();
        }

        /// <summary>
        /// One flown line. <c>q</c> and <c>p</c> are <c>VesselFromParent</c> in the
        /// planetarium frame at <c>rotation</c> degrees; <c>orbitPos</c> and <c>orbitVel</c>
        /// are KSP's own copy of it, which must agree on rails.
        /// </summary>
        public static string Flown(FlownLine line)
        {
            var text = new StringBuilder("{\"kind\":\"flown\"");
            text.Append(",\"ut\":").Append(Number(line.Ut));
            text.Append(",\"pluginUt\":").Append(Number(line.PluginUt));
            text.Append(",\"rotation\":").Append(Number(line.Rotation));
            text.Append(",\"packed\":").Append(line.Packed ? "true" : "false");
            text.Append(",\"loaded\":").Append(line.Loaded ? "true" : "false");
            text.Append(",\"parent\":").Append(line.Parent.ToString(CultureInfo.InvariantCulture));
            text.Append(",\"q\":").Append(Vector(line.Q));
            text.Append(",\"p\":").Append(Vector(line.P));
            text.Append(",\"orbitPos\":").Append(Vector(line.OrbitPos));
            text.Append(",\"orbitVel\":").Append(Vector(line.OrbitVel));
            text.Append(",\"elements\":{\"sma\":").Append(Number(line.Sma))
                .Append(",\"ecc\":").Append(Number(line.Ecc))
                .Append(",\"inc\":").Append(Number(line.Inc))
                .Append(",\"lan\":").Append(Number(line.Lan))
                .Append(",\"argPe\":").Append(Number(line.ArgPe))
                .Append(",\"meanAnomalyAtEpoch\":").Append(Number(line.MeanAnomalyAtEpoch))
                .Append(",\"epoch\":").Append(Number(line.Epoch))
                .Append(",\"mu\":").Append(Number(line.Mu)).Append('}');
            if (line.Bodies.Count > 0)
            {
                text.Append(",\"bodies\":{");
                var first = true;
                foreach (var body in line.Bodies)
                {
                    text.Append(first ? "" : ",").Append('"').Append(body.Key.ToString(CultureInfo.InvariantCulture)).Append("\":")
                        .Append("{\"q\":").Append(Vector(body.Value.Q)).Append(",\"p\":").Append(Vector(body.Value.P)).Append('}');
                    first = false;
                }
                text.Append('}');
            }
            return text.Append('}').ToString();
        }

        /// <summary>
        /// The seed a private copy is asked to start from: the game's own Principia state
        /// at one instant, in the planetarium frame at the rotation it was read under.
        /// </summary>
        public static string Seed(double ut, int parent, double rotation, Triple q, Triple p) =>
            "{\"ut\":" + Number(ut)
            + ",\"parent\":" + parent.ToString(CultureInfo.InvariantCulture)
            + ",\"rotation\":" + Number(rotation)
            + ",\"q\":" + Vector(q)
            + ",\"p\":" + Vector(p) + "}";

        /// <summary>A free-form fact recorded once, such as the prediction parameters.</summary>
        public static string Fact(string name, string value) =>
            "{\"kind\":\"fact\",\"name\":" + Text(name) + ",\"value\":" + Text(value) + "}";

        /// <summary>One point of a flight plan's coast, about the parent, planetarium frame at <c>rotation</c>.</summary>
        public static string PlanPoint(double ut, double rotation, Triple q, Triple p) =>
            "{\"kind\":\"plan\",\"ut\":" + Number(ut) + ",\"rotation\":" + Number(rotation)
            + ",\"q\":" + Vector(q) + ",\"p\":" + Vector(p) + "}";
    }
}
