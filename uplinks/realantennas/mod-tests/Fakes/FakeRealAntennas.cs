#nullable disable
using System;
using System.Collections.Generic;

/*
 * Stand-ins for the RealAntennas types the Uplink reads by reflection, under
 * RealAntennas' own type and member names. Each getter is shaped like the one
 * it stands for, so a read costs here what it costs there in kind: Encoder
 * walks the encoder table, Shape and Beamwidth read Gain, a digital antenna's
 * least symbol rate comes off its modulator. Every property read is counted.
 */

namespace RealAntennas
{
    /// <summary>How many property reads the fake antennas have answered.</summary>
    public static class FakeReads
    {
        public static long Count;
    }

    public class TechLevelInfo
    {
        public int Level;
        public float ReceiverNoiseTemperature;
        public float PowerEfficiency = 0.5f;
        public float ReflectorEfficiency = 0.6f;
        public float BasePower = 100f;

        private static readonly Dictionary<int, TechLevelInfo> Levels = new Dictionary<int, TechLevelInfo>();

        public static TechLevelInfo GetTechLevel(int level)
        {
            if (!Levels.TryGetValue(level, out var info))
            {
                info = new TechLevelInfo { Level = level, ReceiverNoiseTemperature = 400f - 30f * level };
                Levels[level] = info;
            }
            return info;
        }
    }

    public class BandInfo
    {
        public string name = "S";
        public float Frequency = 2.25e9f;

        private static readonly Dictionary<string, BandInfo> Bands = new Dictionary<string, BandInfo>
        {
            ["S"] = new BandInfo { name = "S", Frequency = 2.25e9f },
            ["X"] = new BandInfo { name = "X", Frequency = 8.45e9f },
            ["Ka"] = new BandInfo { name = "Ka", Frequency = 32e9f },
        };

        public static BandInfo Get(string band) => Bands[band];

        public double MaxSymbolRate(int level) => 1000.0 * Math.Pow(2.0, level + 4);
    }

    public enum AntennaShape
    {
        Omni,
        Dish,
    }

    public class ModuleRealAntenna
    {
        public object part;
        public string Condition = "Enabled";
    }

    public class RAModulator
    {
        public RealAntennaDigital Parent;

        public RAModulator(RealAntennaDigital parent, int bits)
        {
            Parent = parent;
            ModulationBits = bits;
        }

        public double SymbolRate => Parent.SymbolRate;

        public int ModulationBits { get; set; }

        public TechLevelInfo TechLevel => Parent.TechLevelInfo;

        public int SymbolSteps => 2 * TechLevel.Level + 3;

        public double MinSymbolRate => SymbolRate / Math.Pow(2.0, SymbolSteps);
    }

    public class RealAntenna
    {
        public TechLevelInfo TechLevelInfo = TechLevelInfo.GetTechLevel(0);
        public BandInfo RFBand = BandInfo.Get("S");
        private Targeting.AntennaTarget _target;
        private float _gain;
        private float _txPower = 30f;
        private double _symbolRate = 1000.0;
        private float _amwTemp = 290f;
        private string _encoderOverride;

        public string Name { get; set; }

        public virtual float Gain { get { FakeReads.Count++; return _gain; } set { _gain = value; } }

        public virtual float TxPower { get { FakeReads.Count++; return _txPower; } set { _txPower = value; } }

        public virtual double SymbolRate { get { FakeReads.Count++; return _symbolRate; } set { _symbolRate = value; } }

        public virtual double MinSymbolRate { get { FakeReads.Count++; return SymbolRate / 1000.0; } }

        public virtual float Frequency { get { FakeReads.Count++; return RFBand.Frequency; } }

        public virtual float PowerEfficiency => TechLevelInfo.PowerEfficiency;

        public virtual float AMWTemp { get { FakeReads.Count++; return _amwTemp; } set { _amwTemp = value; } }

        public virtual float Beamwidth { get { FakeReads.Count++; return (float)Math.Sqrt(52525.0 / Math.Pow(10.0, Gain / 10.0)); } }

        public virtual string EncoderOverride { get { FakeReads.Count++; return _encoderOverride; } set { _encoderOverride = value; } }

        public Antenna.Encoder Encoder
        {
            get
            {
                FakeReads.Count++;
                return Antenna.Encoder.GetFromName(EncoderOverride) ?? Antenna.Encoder.GetFromTechLevel(TechLevelInfo.Level);
            }
        }

        public virtual float RequiredCI { get { FakeReads.Count++; return Encoder.RequiredEbN0; } }

        public ModuleRealAntenna Parent { get; set; }

        public object ParentSnapshot { get; set; }

        public object ParentNode { get; set; }

        public virtual AntennaShape Shape { get { FakeReads.Count++; return Gain <= 5f ? AntennaShape.Omni : AntennaShape.Dish; } }

        public Targeting.AntennaTarget Target { get { FakeReads.Count++; return _target; } set { _target = value; } }

        public virtual float PowerDrawLinear { get { FakeReads.Count++; return (float)Math.Pow(10.0, TxPower / 10.0) / PowerEfficiency; } }
    }

    public class RealAntennaDigital : RealAntenna
    {
        public RAModulator modulator;

        public RealAntennaDigital()
        {
            modulator = new RAModulator(this, 1);
        }

        public override double MinSymbolRate { get { FakeReads.Count++; return modulator.MinSymbolRate; } }
    }

    public static class Physics
    {
        public static float AntennaMicrowaveTemp(RealAntenna rx)
        {
            FakeReads.Count++;
            return rx.ParentNode is RACommNode node && node.isGroundStation ? rx.AMWTemp : rx.TechLevelInfo.ReceiverNoiseTemperature;
        }

        public static float BodyBaseTemperature(object body)
        {
            FakeReads.Count++;
            return 250f;
        }
    }

    public class RACommNetScenario
    {
        public static int minRelayTL = 0;
    }

    public class RACommNode
    {
        public List<RealAntenna> RAAntennaList { get; set; } = new List<RealAntenna>();

        public object ParentBody { get; set; }

        public bool isGroundStation => ParentBody != null;

        public string Label = "";
    }
}

namespace RealAntennas.Antenna
{
    public class Encoder
    {
        public string name;
        public int TechLevel;
        public float CodingRate;
        public float RequiredEbN0;

        public static readonly Dictionary<string, Encoder> All = new Dictionary<string, Encoder>
        {
            ["None"] = new Encoder { name = "None", TechLevel = 0, CodingRate = 1f, RequiredEbN0 = 10f },
            ["Reed-Muller 1,5"] = new Encoder { name = "Reed-Muller 1,5", TechLevel = 2, CodingRate = 0.1875f, RequiredEbN0 = 8f },
            ["Convolutional 1/2 k=7"] = new Encoder { name = "Convolutional 1/2 k=7", TechLevel = 3, CodingRate = 0.5f, RequiredEbN0 = 4.5f },
            ["Concatenated RS/Conv"] = new Encoder { name = "Concatenated RS/Conv", TechLevel = 5, CodingRate = 0.437f, RequiredEbN0 = 2.5f },
            ["Turbo 1/2"] = new Encoder { name = "Turbo 1/2", TechLevel = 7, CodingRate = 0.5f, RequiredEbN0 = 1f },
            ["Turbo 1/6"] = new Encoder { name = "Turbo 1/6", TechLevel = 8, CodingRate = 0.1667f, RequiredEbN0 = -0.1f },
            ["LDPC 9/10"] = new Encoder { name = "LDPC 9/10", TechLevel = 9, CodingRate = 0.9f, RequiredEbN0 = 3.85f },
        };

        public static Encoder GetFromName(string name) => string.IsNullOrEmpty(name) ? null : All[name];

        public static Encoder GetFromTechLevel(int level)
        {
            Encoder best = null;
            foreach (var value in All.Values)
            {
                if (level >= value.TechLevel && (best == null || value.TechLevel > best.TechLevel))
                {
                    best = value;
                }
            }
            return best;
        }
    }
}

namespace RealAntennas.Targeting
{
    public struct FakeVector3
    {
        public float x;
        public float y;
        public float z;
    }

    public class AntennaTarget
    {
    }

    public class AntennaTargetVessel : AntennaTarget
    {
        public string vesselId = string.Empty;
        public string vesselName = "";

        public override string ToString() => vesselName;
    }

    public class AntennaTargetLatLonAlt : AntennaTarget
    {
        public string bodyName = string.Empty;
        public FakeVector3 latLonAlt;

        public override string ToString() => string.Format("{0}:({1:F2}:{2:F2}:{3:F0})", bodyName, latLonAlt.x, latLonAlt.y, latLonAlt.z);
    }
}
