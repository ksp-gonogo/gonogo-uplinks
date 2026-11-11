using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace GonogoPrinProbe
{
    /// <summary>
    /// Records what the game's own Principia holds for the active craft, as numbers, so a
    /// private copy can be checked against it. A development instrument: it is never
    /// packaged and never shipped.
    ///
    /// <para>It does nothing until a file appears in its PluginData folder:</para>
    /// <list type="bullet">
    /// <item><c>go</c>: record every fixed update for the number of game seconds the file
    /// holds (3600 when empty), and write the seed file the Principia Uplink's seed mode reads,
    /// <c>GonogoPrincipiaUplink/Plugins/prinprobe-seed.json</c>, which is deleted to end that mode</item>
    /// <item><c>plan</c>: in a disposable save only, coast a flight plan with no manoeuvres for
    /// the seconds the file holds, at the craft's prediction settings, record it, delete it</item>
    /// <item><c>stop</c>: stop recording</item>
    /// </list>
    ///
    /// <para>Every call into Principia goes through its own managed forwarder by reflection.
    /// Recording only reads. The plan trigger writes a flight plan and removes it, and refuses
    /// when the craft already has one.</para>
    /// </summary>
    [KSPAddon(KSPAddon.Startup.Flight, false)]
    public sealed class PrinProbe : MonoBehaviour
    {
        private const string InterfaceTypeName = "principia.ksp_plugin_adapter.Interface";
        private const string AdapterTypeName = "principia.ksp_plugin_adapter.PrincipiaPluginAdapter";
        private const int BodiesEvery = 10;

        private string _folder = "";
        private string _seedFile = "";
        private Type? _interface;
        private UnityEngine.Object? _adapter;
        private StreamWriter? _out;
        private double _until;
        private int _frames;
        private float _nextPoll;

        private void Awake()
        {
            var here = Path.GetDirectoryName(typeof(PrinProbe).Assembly.Location) ?? ".";
            var root = Path.GetFullPath(Path.Combine(here, ".."));
            _folder = Path.Combine(root, "PluginData");
            Directory.CreateDirectory(_folder);
            _seedFile = Path.GetFullPath(Path.Combine(root, "..", "GonogoPrincipiaUplink", "Plugins", "prinprobe-seed.json"));
            TimingManager.FixedUpdateAdd(TimingManager.TimingStage.Late, AfterPrincipia);
        }

        private void OnDestroy()
        {
            TimingManager.FixedUpdateRemove(TimingManager.TimingStage.Late, AfterPrincipia);
            Close("scene ended");
        }

        private void Update()
        {
            if (Time.unscaledTime < _nextPoll)
            {
                return;
            }
            _nextPoll = Time.unscaledTime + 1f;
            if (Take("stop") != null)
            {
                Close("stop file");
            }
            var go = Take("go");
            if (go != null)
            {
                Begin(Seconds(go));
            }
            var plan = Take("plan");
            if (plan != null)
            {
                CapturePlan(Seconds(plan));
            }
        }

        private string? Take(string name)
        {
            var path = Path.Combine(_folder, name);
            if (!File.Exists(path))
            {
                return null;
            }
            var text = File.ReadAllText(path);
            File.Delete(path);
            return text;
        }

        private static double Seconds(string text) =>
            double.TryParse(text.Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var s) && s > 0
                ? s
                : 3600.0;

        private void Begin(double seconds)
        {
            Close("restarted");
            if (!Bind(out var why))
            {
                Debug.Log("[PrinProbe] cannot record: " + why);
                return;
            }
            var ut = Planetarium.GetUniversalTime();
            var path = Path.Combine(_folder, "flown-" + ProbeRecord.Number(Math.Round(ut, 2)) + ".jsonl");
            _out = new StreamWriter(path, append: false);
            _until = ut + seconds;
            _frames = 0;
            WriteFacts();
            Debug.Log("[PrinProbe] recording to " + path + " until UT " + ProbeRecord.Number(_until));
        }

        private void Close(string why)
        {
            if (_out == null)
            {
                return;
            }
            _out.WriteLine(ProbeRecord.Fact("closed", why));
            _out.Dispose();
            _out = null;
            Debug.Log("[PrinProbe] recording closed: " + why);
        }

        private bool Bind(out string why)
        {
            _interface ??= AppDomain.CurrentDomain.GetAssemblies()
                .Select(a => a.GetType(InterfaceTypeName, throwOnError: false))
                .FirstOrDefault(t => t != null);
            var adapterType = AppDomain.CurrentDomain.GetAssemblies()
                .Select(a => a.GetType(AdapterTypeName, throwOnError: false))
                .FirstOrDefault(t => t != null);
            _adapter = adapterType == null ? null : FindObjectOfType(adapterType);
            why = _interface == null ? "Principia's Interface type is not loaded"
                : _adapter == null ? "Principia's adapter is not in this scene"
                : Plugin() == IntPtr.Zero ? "Principia has no plugin yet"
                : "";
            return why.Length == 0;
        }

        private IntPtr Plugin()
        {
            if (_adapter == null)
            {
                return IntPtr.Zero;
            }
            var field = _adapter.GetType().GetField("plugin_", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
            return field?.GetValue(_adapter) is IntPtr handle ? handle : IntPtr.Zero;
        }

        private object? Call(string name, params object?[] args)
        {
            var method = _interface!.GetMethod(name, BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                ?? throw new MissingMethodException(InterfaceTypeName, name);
            return method.Invoke(null, args);
        }

        private MethodInfo Method(string name) =>
            _interface!.GetMethod(name, BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(InterfaceTypeName, name);

        private static double Field(object boxed, string name) =>
            Convert.ToDouble(boxed.GetType().GetField(name)!.GetValue(boxed), System.Globalization.CultureInfo.InvariantCulture);

        private static Triple Xyz(object xyz) => new Triple(Field(xyz, "x"), Field(xyz, "y"), Field(xyz, "z"));

        private static (Triple Q, Triple P) Qp(object qp) =>
            (Xyz(qp.GetType().GetField("q")!.GetValue(qp)), Xyz(qp.GetType().GetField("p")!.GetValue(qp)));

        private static Triple Of(Vector3d v) => new Triple(v.x, v.y, v.z);

        private void WriteFacts()
        {
            var vessel = FlightGlobals.ActiveVessel;
            var plugin = Plugin();
            var guid = vessel.id.ToString();
            _out!.WriteLine(ProbeRecord.Fact("vessel", vessel.vesselName + " " + guid));
            _out.WriteLine(ProbeRecord.Fact("predictionParameters", ProbeRecord.Describe(Call("VesselGetPredictionAdaptiveStepParameters", plugin, guid))));
            foreach (var node in new[] { "principia_numerics_blueprint", "principia_gravity_model", "principia_initial_state" })
            {
                var nodes = GameDatabase.Instance.GetConfigNodes(node);
                _out.WriteLine(ProbeRecord.Fact(node, nodes.Length == 0 ? "absent" : nodes[0].ToString()));
            }
            WriteSeed(vessel, plugin, guid);
        }

        private void WriteSeed(Vessel vessel, IntPtr plugin, string guid)
        {
            if (!(Call("HasVessel", plugin, guid) is bool has && has))
            {
                _out!.WriteLine(ProbeRecord.Fact("seed", "Principia does not hold the active craft"));
                return;
            }
            var parent = vessel.mainBody.flightGlobalsIndex;
            var (q, p) = Qp(Call("VesselFromParent", plugin, parent, guid)!);
            var ut = (double)Call("CurrentTime", plugin)!;
            var seed = ProbeRecord.Seed(ut, parent, Planetarium.InverseRotAngle, q, p);
            File.WriteAllText(Path.Combine(_folder, "seed-" + ProbeRecord.Number(Math.Round(ut, 2)) + ".json"), seed);
            if (Directory.Exists(Path.GetDirectoryName(_seedFile)))
            {
                File.WriteAllText(_seedFile, seed);
            }
            _out!.WriteLine(ProbeRecord.Fact("seed", seed));
        }

        private void AfterPrincipia()
        {
            if (_out == null)
            {
                return;
            }
            try
            {
                Record();
            }
            catch (Exception e)
            {
                Close("failed: " + e);
            }
        }

        private void Record()
        {
            var ut = Planetarium.GetUniversalTime();
            if (ut > _until)
            {
                Close("reached the end");
                return;
            }
            var vessel = FlightGlobals.ActiveVessel;
            var plugin = Plugin();
            var guid = vessel?.id.ToString();
            if (vessel == null || plugin == IntPtr.Zero || !(Call("HasVessel", plugin, guid) is bool has && has))
            {
                return;
            }
            var parent = vessel.mainBody.flightGlobalsIndex;
            var (q, p) = Qp(Call("VesselFromParent", plugin, parent, guid)!);
            var orbit = vessel.orbit;
            var line = new FlownLine
            {
                Ut = ut,
                PluginUt = (double)Call("CurrentTime", plugin)!,
                Rotation = Planetarium.InverseRotAngle,
                Packed = vessel.packed,
                Loaded = vessel.loaded,
                Parent = parent,
                Q = q,
                P = p,
                OrbitPos = Of(orbit.pos),
                OrbitVel = Of(orbit.vel),
                Sma = orbit.semiMajorAxis,
                Ecc = orbit.eccentricity,
                Inc = orbit.inclination,
                Lan = orbit.LAN,
                ArgPe = orbit.argumentOfPeriapsis,
                MeanAnomalyAtEpoch = orbit.meanAnomalyAtEpoch,
                Epoch = orbit.epoch,
                Mu = orbit.referenceBody.gravParameter,
            };
            if (_frames++ % BodiesEvery == 0)
            {
                foreach (var body in FlightGlobals.Bodies)
                {
                    if (body.orbit?.referenceBody == null)
                    {
                        continue;
                    }
                    line.Bodies.Add(new KeyValuePair<int, (Triple, Triple)>(
                        body.flightGlobalsIndex, Qp(Call("CelestialFromParent", plugin, body.flightGlobalsIndex)!)));
                }
            }
            _out!.WriteLine(ProbeRecord.Flown(line));
        }

        /*
         * The flight plan's segment is rendered in the plotting frame, placed in Unity's world
         * at the current instant. With the plotting frame centred on the craft's parent and not
         * rotating, a point minus the parent's world position is the point about the parent in
         * world axes, and the self-check below catches any other frame: the first point has to
         * be the craft's own state.
         */
        private void CapturePlan(double seconds)
        {
            if (!Bind(out var why))
            {
                Debug.Log("[PrinProbe] cannot capture a plan: " + why);
                return;
            }
            var vessel = FlightGlobals.ActiveVessel;
            var plugin = Plugin();
            var guid = vessel.id.ToString();
            var ut = Planetarium.GetUniversalTime();
            using var writer = new StreamWriter(Path.Combine(_folder, "plan-" + ProbeRecord.Number(Math.Round(ut, 2)) + ".jsonl"));
            if (Call("FlightPlanExists", plugin, guid) is bool exists && exists)
            {
                writer.WriteLine(ProbeRecord.Fact("plan", "skipped: the craft already has a flight plan, and it is the player's"));
                return;
            }
            var parent = vessel.mainBody.flightGlobalsIndex;
            var (q0, p0) = Qp(Call("VesselFromParent", plugin, parent, guid)!);
            Call("FlightPlanCreate", plugin, guid, ut + seconds, vessel.GetTotalMass());
            try
            {
                var prediction = Call("VesselGetPredictionAdaptiveStepParameters", plugin, guid)!;
                var parameters = Call("FlightPlanGetAdaptiveStepParameters", plugin, guid)!;
                foreach (var field in parameters.GetType().GetFields())
                {
                    var same = prediction.GetType().GetField(field.Name);
                    if (same != null)
                    {
                        field.SetValue(parameters, Convert.ChangeType(same.GetValue(prediction), field.FieldType));
                    }
                }
                writer.WriteLine(ProbeRecord.Fact("planParameters", ProbeRecord.Describe(parameters)));
                writer.WriteLine(ProbeRecord.Fact("planStatus", ProbeRecord.Describe(Call("FlightPlanSetAdaptiveStepParameters", plugin, guid, parameters))));
                writer.WriteLine(ProbeRecord.Fact("planActualFinalTime", ProbeRecord.Describe(Call("FlightPlanGetActualFinalTime", plugin, guid))));
                writer.WriteLine(ProbeRecord.Fact("planVesselState", ProbeRecord.Seed(ut, parent, Planetarium.InverseRotAngle, q0, p0)));

                var segment = Method("FlightPlanRenderedSegment");
                var sunType = segment.GetParameters()[2].ParameterType;
                var sun = Activator.CreateInstance(sunType);
                var sunWorld = Planetarium.fetch.Sun.position;
                sunType.GetField("x")!.SetValue(sun, sunWorld.x);
                sunType.GetField("y")!.SetValue(sun, sunWorld.y);
                sunType.GetField("z")!.SetValue(sun, sunWorld.z);
                var iterator = segment.Invoke(null, new object?[] { plugin, guid, sun, 0 });
                var parentWorld = Of(vessel.mainBody.position);
                var first = true;
                try
                {
                    while (!(bool)Call("IteratorAtEnd", iterator)!)
                    {
                        var (wq, wp) = Qp(Call("IteratorGetDiscreteTrajectoryQP", iterator)!);
                        var t = (double)Call("IteratorGetDiscreteTrajectoryTime", iterator)!;
                        var q = (wq - parentWorld).WorldToPlanetarium();
                        var p = wp.WorldToPlanetarium();
                        if (first)
                        {
                            writer.WriteLine(ProbeRecord.Fact(
                                "planSelfCheck",
                                "first point " + ProbeRecord.Number(t) + " is " + ProbeRecord.Number((q - q0).Length())
                                + " m and " + ProbeRecord.Number((p - p0).Length()) + " m/s from the craft"));
                            first = false;
                        }
                        writer.WriteLine(ProbeRecord.PlanPoint(t, Planetarium.InverseRotAngle, q, p));
                        Call("IteratorIncrement", iterator);
                    }
                }
                finally
                {
                    (iterator as IDisposable)?.Dispose();
                }
            }
            catch (Exception e)
            {
                writer.WriteLine(ProbeRecord.Fact("planFailed", e.ToString()));
            }
            finally
            {
                Call("FlightPlanDelete", plugin, guid);
            }
        }
    }
}
