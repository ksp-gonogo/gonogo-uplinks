using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Sitrep.Contract;

namespace Gonogo.ScansatUplink
{
    /// <summary>One installed part that carries a SCANsat scanner: the scan types it reads, the node it needs, and whether this save has it.</summary>
    internal readonly struct ScannerCarrier
    {
        public ScannerCarrier(int sensorType, string techRequired, bool researched)
        {
            SensorType = sensorType;
            TechRequired = techRequired;
            Researched = researched;
        }

        /// <summary>SCANsat's <c>sensorType</c> bitmask, the same bits as <see cref="ScanChannels.ClientScanTypes"/>.</summary>
        public int SensorType { get; }
        public string TechRequired { get; }
        public bool Researched { get; }
    }

    /// <summary>One tech node's title and research cost, as the save's own tree states them.</summary>
    internal readonly struct ScanTechDescription
    {
        public ScanTechDescription(string title, double? scienceCost)
        {
            Title = title;
            ScienceCost = scienceCost;
        }

        public string Title { get; }
        public double? ScienceCost { get; }
    }

    /// <summary>The live reads behind <see cref="ScanTypeGate"/>, replaceable for a headless test.</summary>
    internal interface IScanTypeReads
    {
        /// <summary>
        /// Whether this game researches at all: null while no game or research
        /// scenario is loaded, false in sandbox, where every part is available.
        /// </summary>
        bool? CareerResearch();

        /// <summary>Every installed part carrying a SCANsat scanner.</summary>
        IReadOnlyList<ScannerCarrier> Carriers();

        ScanTechDescription Describe(string techId);
    }

    /// <summary>
    /// Authority: the installed parts' SCANsat scanner modules and their
    /// <c>sensorType</c> bits, against <c>ResearchAndDevelopment</c>. A scan
    /// type is unlocked once any researched part carries a scanner reading it;
    /// until then the missing node is the cheapest one carrying such a part,
    /// read off the installed parts, so a tree that moves the scanners is
    /// answered by its own placement.
    ///
    /// <para>The scan types are either fixed by
    /// <see cref="CommandRequirement.Quantity"/> (a bitmask, any bit of which
    /// unlocks: altimetry is either resolution) or, for a namespace keyed by
    /// scan type, read off the topic's last segment through
    /// <see cref="ChannelArguments.SubTopic"/>, so <c>scansat.coverage.Kerbin.8</c>
    /// is judged on biome scanners alone.</para>
    ///
    /// <para>Registered whether or not SCANsat is usable, beside every
    /// declaration of its kind. An unusable SCANsat answers Unknown with its
    /// reason.</para>
    /// </summary>
    internal sealed class ScanTypeGate : ICommandGateEvaluator
    {
        public const string KindName = "scansat-scan-type";

        /// <summary>A part whose node the career can never research, such as RP-1's hidden parts.</summary>
        private const string Unresearchable = "Unresearcheable";

        private readonly Func<string?> _unavailable;
        private readonly IScanTypeReads? _reads;

        /// <param name="unavailable">Why SCANsat cannot be used, or null when it can.</param>
        /// <param name="reads">The live reads, null in a build that does not link SCANsat.</param>
        public ScanTypeGate(Func<string?> unavailable, IScanTypeReads? reads)
        {
            _unavailable = unavailable;
            _reads = reads;
        }

        public string Kind => KindName;

        /// <summary>The requirement for a channel any of these scan types reveals.</summary>
        public static CommandRequirement For(int scanTypes) => new CommandRequirement
        {
            Kind = KindName,
            Quantity = scanTypes.ToString(CultureInfo.InvariantCulture),
        };

        /// <summary>The requirement for a namespace whose topics end in their scan type.</summary>
        public static CommandRequirement PerTopic() => new CommandRequirement
        {
            Kind = KindName,
            Needs = new[] { ChannelArguments.SubTopic },
        };

        public GateVerdict Evaluate(CommandRequirement requirement, IGateArguments arguments)
        {
            var scanTypes = ScanTypesOf(requirement, arguments);
            if (scanTypes == 0) return GateVerdict.Unknown("no scan type is named");
            var unavailable = _unavailable();
            if (unavailable != null) return GateVerdict.Unknown(unavailable);
            if (_reads == null) return GateVerdict.Unknown("SCANsat is not linked into this build");

            try
            {
                var research = _reads.CareerResearch();
                if (research == null) return GateVerdict.Unknown("the research scenario is not loaded");
                if (research == false) return GateVerdict.Pass();
                return Decide(scanTypes, _reads.Carriers(), _reads.Describe);
            }
            catch (Exception ex)
            {
                return GateVerdict.Unknown("could not read the installed scanners: " + ex.Message);
            }
        }

        internal static GateVerdict Decide(
            int scanTypes, IReadOnlyList<ScannerCarrier> carriers, Func<string, ScanTechDescription> describe)
        {
            var reading = carriers.Where(c => (c.SensorType & scanTypes) != 0).ToList();
            if (reading.Count == 0) return GateVerdict.Unknown($"no installed part scans type {scanTypes}");
            if (reading.Any(c => c.Researched)) return GateVerdict.Pass();

            var cheapest = reading
                .Select(c => c.TechRequired)
                .Where(id => !string.IsNullOrEmpty(id) && id != Unresearchable)
                .Distinct()
                .Select(id => (Id: id, Description: describe(id)))
                .OrderBy(t => t.Description.ScienceCost ?? double.MaxValue)
                .ThenBy(t => t.Id, StringComparer.Ordinal)
                .FirstOrDefault();
            if (cheapest.Id == null) return GateVerdict.Unknown($"no researchable part scans type {scanTypes}");

            return GateVerdict.NotUnlocked(
                $"no part scanning type {scanTypes} has been researched",
                new MissingUnlock
                {
                    Kind = UnlockKind.Tech,
                    Id = cheapest.Id,
                    Name = cheapest.Description.Title,
                    ScienceCost = cheapest.Description.ScienceCost,
                });
        }

        private static int ScanTypesOf(CommandRequirement requirement, IGateArguments arguments)
        {
            if (!string.IsNullOrEmpty(requirement.Quantity))
            {
                return int.TryParse(requirement.Quantity, NumberStyles.Integer, CultureInfo.InvariantCulture, out var fixedTypes)
                    ? fixedTypes
                    : 0;
            }
            if (!arguments.TryGet(ChannelArguments.SubTopic, out var subTopic) || !(subTopic is string text)) return 0;
            var last = text.Substring(text.LastIndexOf('.') + 1);
            return int.TryParse(last, NumberStyles.Integer, CultureInfo.InvariantCulture, out var keyed) ? keyed : 0;
        }
    }
}
