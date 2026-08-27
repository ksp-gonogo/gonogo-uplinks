#if SITREP_CODEGEN
using System;
using Reinforced.Typings.Fluent;

namespace GonogoExampleUplink;

/// <summary>
/// This Uplink's own codegen configuration, scoped to its one wire type.
///
/// <para>Lives behind <c>SITREP_CODEGEN</c> because the Reinforced.Typings
/// attributes must be compiled into SOMETHING for codegen to read, and that
/// something must not be the shipped assembly: an assembly carrying them also
/// carries a hard metadata reference to <c>Reinforced.Typings.dll</c>, which is
/// deliberately never deployed beside it, and then every consumer breaks the
/// moment it asks one of these types for its attributes. <c>Enum.ToString()</c>
/// asks, because enum formatting looks for <c>[Flags]</c>. The
/// <c>mod-contract-codegen</c> twin recompiles these same sources with the
/// symbol defined, and nothing ships the twin.</para>
///
/// <para><c>valueImportFrom</c> must name the npm package, not the default
/// relative path: the generated file lands in the client's
/// <c>src/__generated__/</c> and a relative <c>../value</c> resolves to
/// nothing from there.</para>
/// </summary>
public static class ExampleRtConfig
{
    public static void Configure(ConfigurationBuilder builder)
    {
        builder.Global(g => g
            .CamelCaseForProperties()
            .UseModules(true)
            .AutoOptionalProperties());

        // A local, because ApplyUnitValueTypes re-enters this exact set: only a
        // type registered with rtcli can have its properties retyped.
        var wireTypes = new[] { typeof(ExampleHeartbeat) };

        builder.ExportAsInterfaces(wireTypes, c => c.AutoI(false).WithPublicProperties());
        Sitrep.Contract.RtConfig.ApplyUnitValueTypes(
            builder, wireTypes, valueImportFrom: "@ksp-gonogo/sitrep-sdk");

        var topicMapOut = Environment.GetEnvironmentVariable("SITREP_EXAMPLE_TOPICMAP_OUT");
        if (!string.IsNullOrEmpty(topicMapOut))
        {
            Sitrep.Contract.RtConfig.EmitTopicMap(topicMapOut!, typeof(ExampleRtConfig).Assembly);
        }

        var unitMapOut = Environment.GetEnvironmentVariable("SITREP_EXAMPLE_UNITMAP_OUT");
        if (!string.IsNullOrEmpty(unitMapOut))
        {
            Sitrep.Contract.RtConfig.EmitUnitMap(
                unitMapOut!,
                Environment.GetEnvironmentVariable("SITREP_EXAMPLE_UNITJSON_OUT"),
                typeof(ExampleRtConfig).Assembly);
        }
    }
}
#endif
