#if SITREP_CODEGEN
using System;
using Reinforced.Typings.Fluent;

namespace GonogoTestFlightUplink;

/// <summary>
/// This Uplink's own codegen configuration, the same shape every slice's
/// <c>Configure</c> has, scoped to this assembly's wire types. Two topic roots
/// (<see cref="TestFlightReliabilitySummary"/> and the array
/// <see cref="TestFlightReliabilityPart"/>), one command and its refusals, so it
/// emits all four maps.
/// </summary>
public static class TestFlightRtConfig
{
    public static void Configure(ConfigurationBuilder builder)
    {
        builder.Global(g => g
            .CamelCaseForProperties()
            .UseModules(true)
            .AutoOptionalProperties()
            .GenerateDocumentation()
            .UseVisitor<Sitrep.Contract.RtDocVisitor>());

        Sitrep.Contract.RtDocText.MergeIntoSummaries(builder);

        // Held in a local because ApplyUnitValueTypes re-enters this exact set:
        // only a type registered with rtcli may have its properties retyped.
        // TestFlightRepairPartArgs ends in "Args", so it stays unwrapped.
        var wireTypes = new[]
        {
            typeof(TestFlightReliabilitySummary),
            typeof(TestFlightReliabilityPart),
            typeof(TestFlightReliabilityBudget),
            typeof(TestFlightRepairPartArgs),
            typeof(TestFlightRepairOutcome),
        };

        builder.ExportAsInterfaces(wireTypes, c => c.AutoI(false).WithPublicProperties());

        Sitrep.Contract.RtConfig.ApplyUnitValueTypes(builder, wireTypes, valueImportFrom: "@ksp-gonogo/sitrep-sdk");

        var topicMapOut = Environment.GetEnvironmentVariable("SITREP_TESTFLIGHT_TOPICMAP_OUT");
        if (!string.IsNullOrEmpty(topicMapOut))
        {
            Sitrep.Contract.RtConfig.EmitTopicMap(topicMapOut!, typeof(TestFlightRtConfig).Assembly);
        }

        var unitMapOut = Environment.GetEnvironmentVariable("SITREP_TESTFLIGHT_UNITMAP_OUT");
        if (!string.IsNullOrEmpty(unitMapOut))
        {
            Sitrep.Contract.RtConfig.EmitUnitMap(
                unitMapOut!,
                Environment.GetEnvironmentVariable("SITREP_TESTFLIGHT_UNITJSON_OUT"),
                typeof(TestFlightRtConfig).Assembly);
        }

        var commandMapOut = Environment.GetEnvironmentVariable("SITREP_TESTFLIGHT_COMMANDMAP_OUT");
        if (!string.IsNullOrEmpty(commandMapOut))
        {
            Sitrep.Contract.RtConfig.EmitCommandMap(
                commandMapOut!,
                typeof(TestFlightRtConfig).Assembly,
                resultImportFrom: "@ksp-gonogo/sitrep-sdk");
        }

        var errorCodesOut = Environment.GetEnvironmentVariable("SITREP_TESTFLIGHT_ERRORCODES_OUT");
        if (!string.IsNullOrEmpty(errorCodesOut))
        {
            Sitrep.Contract.RtConfig.EmitErrorCodeMap(
                errorCodesOut!,
                builder.Context.DocumentationFilePath,
                typeof(TestFlightRtConfig).Assembly,
                declarationImportFrom: "@ksp-gonogo/sitrep-sdk",
                tableName: "TESTFLIGHT_ERROR_CODES");
        }
    }
}
#endif
