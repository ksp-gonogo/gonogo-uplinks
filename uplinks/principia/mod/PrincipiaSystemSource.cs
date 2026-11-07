using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using HarmonyLib;
using UnityEngine;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// Reads what Principia built the player's plugin from, so a private copy can build
    /// its own from the same inputs. This is the file that names game types; it restates
    /// <c>ResetPlugin</c> and <c>ConfigNodeParsers</c> from Principia's adapter, the
    /// same choices in the same order, and holds nothing else.
    ///
    /// <para>Under a config-free install the live body orbits are Principia's own output
    /// by now, so the Keplerian arm reads the originals the adapter captured before it
    /// overwrote them.</para>
    /// </summary>
    internal static class PrincipiaSystemSource
    {
        private const string AdapterType = "principia.ksp_plugin_adapter.PrincipiaPluginAdapter";
        private const string J2000 = "JD2451545";

        /// <summary>The system as text, or null when the game or the adapter cannot say yet.</summary>
        public static string? Read()
        {
            try
            {
                return Build()?.ToText();
            }
            catch (Exception e)
            {
                Debug.LogWarning("[Gonogo] Could not read the solar system for Principia's private copy: " + e.Message);
                return null;
            }
        }

        /// <summary>
        /// Every body but the star, about its parent, as the game holds them, plus the
        /// planetarium's rotation. Principia writes each body's orbit from its plugin every
        /// step, so these are the plugin's states, read with no call into it.
        /// </summary>
        public static PrincipiaGameReading? ReadGame()
        {
            if (!HasBodies() || Planetarium.fetch == null)
            {
                return null;
            }
            var main = FlightGlobals.currentMainBody;
            var reading = new PrincipiaGameReading
            {
                Ut = Planetarium.GetUniversalTime(),
                InverseRotAngle = Planetarium.InverseRotAngle,
                FrameFacts = main == null
                    ? "no main body;"
                    : main.bodyName + " rotating frame " + main.inverseRotation
                        + ", threshold " + main.inverseRotThresholdAltitude + " m;",
            };
            foreach (var body in FlightGlobals.Bodies)
            {
                if (body == null || body.orbit == null || body.orbit.referenceBody == null)
                {
                    continue;
                }
                var q = body.orbit.pos;
                var p = body.orbit.vel;
                reading.Bodies.Add(new PrincipiaBodyReading(
                    body.flightGlobalsIndex, body.bodyName, new[] { q.x, q.y, q.z, p.x, p.y, p.z }));
            }
            return reading;
        }

        private static PrincipiaWorkerSystem? Build()
        {
            var database = GameDatabase.Instance;
            var sun = Planetarium.fetch?.Sun;
            if (database == null || sun == null || !HasBodies())
            {
                return null;
            }

            var gravity = OneNode(database, "principia_gravity_model");
            var state = OneNode(database, "principia_initial_state");
            var gravityByName = NodesByName(gravity);
            var stateByName = NodesByName(state);
            if (state != null && gravity == null)
            {
                return null;
            }

            var system = new PrincipiaWorkerSystem
            {
                GameEpoch = state?.GetValue("game_epoch") ?? J2000,
                SolarSystemEpoch = state?.GetValue("solar_system_epoch") ?? J2000,
                PlanetariumRotation = Planetarium.InverseRotAngle,
            };
            ReadNumerics(OneNode(database, "principia_numerics_blueprint"), system);

            IDictionary? orbits = null;
            IDictionary? rotations = null;
            if (state == null)
            {
                var adapter = AccessTools.TypeByName(AdapterType);
                orbits = adapter == null ? null : AccessTools.Field(adapter, "unmodified_orbits_")?.GetValue(null) as IDictionary;
                rotations = adapter == null ? null : AccessTools.Field(adapter, "unmodified_initial_rotations_")?.GetValue(null) as IDictionary;
                if (orbits == null || rotations == null)
                {
                    return null;
                }
            }

            foreach (var body in InsertionOrder(sun))
            {
                gravityByName.TryGetValue(body.name, out var bodyGravity);
                if (state != null)
                {
                    if (bodyGravity == null || !stateByName.TryGetValue(body.name, out var bodyState))
                    {
                        return null;
                    }
                    system.Bodies.Add(CartesianBody(body, bodyGravity, bodyState));
                }
                else
                {
                    system.Bodies.Add(KeplerianBody(body, bodyGravity, orbits![body] as Orbit, rotations![body]));
                }
            }
            return system;
        }

        private static bool HasBodies() => FlightGlobals.Bodies != null && FlightGlobals.Bodies.Count > 0;

        private static ConfigNode? OneNode(GameDatabase database, string name)
        {
            var nodes = database.GetConfigNodes(name);
            return nodes != null && nodes.Length == 1 ? nodes[0] : null;
        }

        private static Dictionary<string, ConfigNode> NodesByName(ConfigNode? parent)
        {
            var byName = new Dictionary<string, ConfigNode>();
            if (parent != null)
            {
                foreach (var node in parent.GetNodes("body"))
                {
                    byName[node.GetValue("name")] = node;
                }
            }
            return byName;
        }

        /// <summary>The Sun, then a stack walk of the body tree, the order Principia's adapter inserts them in.</summary>
        private static IEnumerable<CelestialBody> InsertionOrder(CelestialBody sun)
        {
            yield return sun;
            var stack = new Stack<CelestialBody>();
            foreach (var child in sun.orbitingBodies)
            {
                stack.Push(child);
            }
            while (stack.Count > 0)
            {
                var body = stack.Pop();
                yield return body;
                foreach (var child in body.orbitingBodies)
                {
                    stack.Push(child);
                }
            }
        }

        private static void ReadNumerics(ConfigNode? blueprint, PrincipiaWorkerSystem system)
        {
            if (blueprint == null)
            {
                return;
            }
            Section(blueprint, system, "downsampling", ("tolerance", "tolerance"));
            Section(
                blueprint, system, "ephemeris",
                ("fittingTolerance", "fitting_tolerance"),
                ("geopotentialTolerance", "geopotential_tolerance"),
                ("fixedStepSizeIntegrator", "fixed_step_size_integrator"),
                ("integrationStepSize", "integration_step_size"));
            Section(
                blueprint, system, "history",
                ("fixedStepSizeIntegrator", "fixed_step_size_integrator"),
                ("integrationStepSize", "integration_step_size"));
            Section(
                blueprint, system, "psychohistory",
                ("adaptiveStepSizeIntegrator", "adaptive_step_size_integrator"),
                ("lengthIntegrationTolerance", "length_integration_tolerance"),
                ("speedIntegrationTolerance", "speed_integration_tolerance"));
        }

        private static void Section(
            ConfigNode blueprint, PrincipiaWorkerSystem system, string name, params (string To, string From)[] fields)
        {
            var nodes = blueprint.GetNodes(name);
            if (nodes.Length != 1)
            {
                return;
            }
            var values = new Dictionary<string, string>();
            foreach (var field in fields)
            {
                values[field.To] = nodes[0].GetValue(field.From);
            }
            system.Numerics[name] = values;
        }

        private static PrincipiaWorkerBody Common(CelestialBody body)
        {
            // String concatenation rather than a format, so a value reads exactly as the
            // adapter's own concatenation wrote it for the player's plugin.
            return new PrincipiaWorkerBody
            {
                Index = body.flightGlobalsIndex,
                ParentIndex = body.orbit?.referenceBody?.flightGlobalsIndex,
                Name = body.name,
                MinRadius = (body.pqsController?.radiusMin ?? body.Radius) + " m",
                MeanRadius = body.Radius + " m",
                MaxRadius = (body.pqsController?.radiusMax ?? body.Radius) + " m",
                AtmosphereDepth = body.atmosphereDepth + " m",
                HasOcean = body.ocean,
            };
        }

        private static PrincipiaWorkerBody CartesianBody(CelestialBody game, ConfigNode gravity, ConfigNode state)
        {
            var body = Common(game);
            body.GravitationalParameter = gravity.GetValue("gravitational_parameter");
            body.ReferenceInstant = gravity.GetValue("reference_instant");
            body.AxisRightAscension = gravity.GetValue("axis_right_ascension");
            body.AxisDeclination = gravity.GetValue("axis_declination");
            body.ReferenceAngle = gravity.GetValue("reference_angle");
            body.AngularFrequency = gravity.GetValue("angular_frequency");
            body.ReferenceRadius = gravity.GetValue("reference_radius");
            body.J2 = gravity.GetValue("j2");
            ReadGeopotential(gravity, body);
            body.Cartesian = new PrincipiaWorkerCartesian
            {
                X = state.GetValue("x"),
                Y = state.GetValue("y"),
                Z = state.GetValue("z"),
                Vx = state.GetValue("vx"),
                Vy = state.GetValue("vy"),
                Vz = state.GetValue("vz"),
            };
            return body;
        }

        private static PrincipiaWorkerBody KeplerianBody(
            CelestialBody game, ConfigNode? gravity, Orbit? orbit, object? initialRotation)
        {
            var body = Common(game);
            body.ParentIndex = orbit?.referenceBody?.flightGlobalsIndex;
            var j2 = gravity?.GetValue("j2");
            body.J2 = j2;
            if (gravity != null)
            {
                ReadGeopotential(gravity, body);
            }
            body.GravitationalParameter = gravity?.GetValue("gravitational_parameter") ?? game.gravParameter + " m^3/s^2";
            body.ReferenceInstant = gravity?.GetValue("reference_instant") ?? "JD2451545.0";
            body.AxisRightAscension = gravity?.GetValue("axis_right_ascension") ?? "-90 deg";
            body.AxisDeclination = gravity?.GetValue("axis_declination") ?? "90 deg";
            body.ReferenceAngle = gravity?.GetValue("reference_angle")
                ?? Convert.ToDouble(initialRotation, CultureInfo.InvariantCulture) + " deg";
            body.AngularFrequency = gravity?.GetValue("angular_frequency") ?? game.angularV + " rad/s";
            body.ReferenceRadius = gravity?.GetValue("reference_radius")
                ?? (j2 != null || body.Geopotential.Count != 0 ? game.Radius + " m" : null);
            if (orbit != null)
            {
                var meanMotion = 2 * Math.PI / orbit.period;
                body.Elements = new PrincipiaWorkerElements
                {
                    Eccentricity = orbit.eccentricity,
                    MeanMotion = meanMotion,
                    Inclination = orbit.inclination,
                    LongitudeOfAscendingNode = orbit.LAN,
                    ArgumentOfPeriapsis = orbit.argumentOfPeriapsis,
                    MeanAnomaly = orbit.meanAnomalyAtEpoch - (orbit.epoch * meanMotion),
                };
            }
            return body;
        }

        private static void ReadGeopotential(ConfigNode gravity, PrincipiaWorkerBody body)
        {
            foreach (var row in gravity.GetNodes("geopotential_row"))
            {
                var degree = row.GetValue("degree");
                foreach (var column in row.GetNodes("geopotential_column"))
                {
                    body.Geopotential.Add(new PrincipiaWorkerGeopotential
                    {
                        Degree = degree,
                        Order = column.GetValue("order"),
                        Cos = column.GetValue("cos"),
                        J = column.GetValue("j"),
                        Sin = column.GetValue("sin"),
                    });
                }
            }
        }
    }
}
