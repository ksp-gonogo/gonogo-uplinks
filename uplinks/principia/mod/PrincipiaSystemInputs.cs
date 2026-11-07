using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace GonogoPrincipiaUplink
{
    /// <summary>The numbers one body orbits by, as Principia's Keplerian initial state takes them.</summary>
    public sealed class PrincipiaWorkerElements
    {
        public double Eccentricity;
        public double MeanMotion;
        public double Inclination;
        public double LongitudeOfAscendingNode;
        public double ArgumentOfPeriapsis;
        public double MeanAnomaly;
    }

    /// <summary>One body's initial state as Principia's Cartesian initial state takes it, kept as the config's own strings.</summary>
    public sealed class PrincipiaWorkerCartesian
    {
        public string X = "";
        public string Y = "";
        public string Z = "";
        public string Vx = "";
        public string Vy = "";
        public string Vz = "";
    }

    /// <summary>One column of a body's geopotential, as the config's own strings.</summary>
    public sealed class PrincipiaWorkerGeopotential
    {
        public string Degree = "";
        public string Order = "";
        public string? Cos;
        public string? J;
        public string Sin = "";
    }

    /// <summary>One body as the private copy's plugin is told about it. The fields are the strings Principia's adapter passes for the same body.</summary>
    public sealed class PrincipiaWorkerBody
    {
        public int Index;
        public int? ParentIndex;
        public string Name = "";
        public string GravitationalParameter = "";
        public string? ReferenceInstant;
        public string? MinRadius;
        public string? MeanRadius;
        public string? MaxRadius;
        public string? AtmosphereDepth;
        public bool HasOcean;
        public string? AxisRightAscension;
        public string? AxisDeclination;
        public string? ReferenceAngle;
        public string? AngularFrequency;
        public string? ReferenceRadius;
        public string? J2;
        public List<PrincipiaWorkerGeopotential> Geopotential = new List<PrincipiaWorkerGeopotential>();
        public PrincipiaWorkerElements? Elements;
        public PrincipiaWorkerCartesian? Cartesian;
    }

    /// <summary>
    /// The solar system a private copy builds its own plugin from: the same inputs Principia
    /// gave the player's, in the same order, so a plugin started at the same epoch
    /// computes the same ephemeris. Holds no game type, so it is tested with no game.
    /// </summary>
    public sealed class PrincipiaWorkerSystem
    {
        public string GameEpoch = "";
        public string SolarSystemEpoch = "";
        public double PlanetariumRotation;
        public List<PrincipiaWorkerBody> Bodies = new List<PrincipiaWorkerBody>();

        /// <summary>Named numeric settings by section, as the numerics blueprint spells them. Sections the install does not set are absent.</summary>
        public Dictionary<string, Dictionary<string, string>> Numerics =
            new Dictionary<string, Dictionary<string, string>>();

        /// <summary>The whole system as lines of tab-separated fields, the form the native half reads. An absent value is an empty field.</summary>
        public string ToText()
        {
            var text = new StringBuilder();
            Line(text, "S", GameEpoch, SolarSystemEpoch, Number(PlanetariumRotation));
            if (Numerics.TryGetValue("downsampling", out var downsampling))
            {
                Line(text, "D", Get(downsampling, "tolerance"));
            }
            if (Numerics.TryGetValue("ephemeris", out var ephemeris))
            {
                Line(
                    text,
                    "A",
                    Get(ephemeris, "fittingTolerance"),
                    Get(ephemeris, "geopotentialTolerance"),
                    Get(ephemeris, "fixedStepSizeIntegrator"),
                    Get(ephemeris, "integrationStepSize"));
            }
            if (Numerics.TryGetValue("history", out var history))
            {
                Line(text, "H", Get(history, "fixedStepSizeIntegrator"), Get(history, "integrationStepSize"));
            }
            if (Numerics.TryGetValue("psychohistory", out var psychohistory))
            {
                Line(
                    text,
                    "Y",
                    Get(psychohistory, "adaptiveStepSizeIntegrator"),
                    Get(psychohistory, "lengthIntegrationTolerance"),
                    Get(psychohistory, "speedIntegrationTolerance"));
            }
            foreach (var body in Bodies)
            {
                Line(
                    text,
                    "B",
                    body.Index.ToString(CultureInfo.InvariantCulture),
                    body.ParentIndex?.ToString(CultureInfo.InvariantCulture),
                    body.Name,
                    body.GravitationalParameter,
                    body.ReferenceInstant,
                    body.MinRadius,
                    body.MeanRadius,
                    body.MaxRadius,
                    body.AtmosphereDepth,
                    body.HasOcean ? "1" : "0",
                    body.AxisRightAscension,
                    body.AxisDeclination,
                    body.ReferenceAngle,
                    body.AngularFrequency,
                    body.ReferenceRadius,
                    body.J2);
                if (body.Elements != null)
                {
                    var e = body.Elements;
                    Line(
                        text,
                        "E",
                        Number(e.Eccentricity),
                        Number(e.MeanMotion),
                        Number(e.Inclination),
                        Number(e.LongitudeOfAscendingNode),
                        Number(e.ArgumentOfPeriapsis),
                        Number(e.MeanAnomaly));
                }
                if (body.Cartesian != null)
                {
                    var c = body.Cartesian;
                    Line(text, "C", c.X, c.Y, c.Z, c.Vx, c.Vy, c.Vz);
                }
                foreach (var row in body.Geopotential)
                {
                    Line(text, "G", row.Degree, row.Order, row.Cos, row.J, row.Sin);
                }
            }
            return text.ToString();
        }

        private static string? Get(Dictionary<string, string> section, string key) =>
            section.TryGetValue(key, out var value) ? value : null;

        private static void Line(StringBuilder text, string kind, params string?[] fields)
        {
            text.Append(kind);
            foreach (var field in fields)
            {
                text.Append('\t').Append(field);
            }
            text.Append('\n');
        }

        internal static string Number(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    }
}
