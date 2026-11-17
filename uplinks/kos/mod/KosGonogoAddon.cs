// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using System.Reflection;
using System.Reflection.Emit;
using kOS;
using kOS.AddOns;
using kOS.Module;
using kOS.Safe.Encapsulation;
using kOS.Safe.Encapsulation.Suffixes;
using kOS.Safe.Utilities;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// <c>ADDONS:GONOGO</c>, the kerboscript side of a run started from a
    /// dashboard. <c>ADDONS:GONOGO:RETURN(LEXICON(...))</c> hands the lexicon
    /// back as the run's result; called with no run waiting on that CPU it does
    /// nothing. The addon class is built at runtime (<see cref="KosRuntimeSubclass"/>)
    /// and registered with kOS by <see cref="Register"/>, since the plugin may
    /// not contain a class derived from a kOS type.
    /// </summary>
    public static class KosGonogoAddon
    {
        /// <summary>The name scripts reach the addon by.</summary>
        public const string Identifier = "GONOGO";

        /// <summary>Where a returned lexicon goes: the CPU's <c>KOSCoreId</c> and the field map.</summary>
        internal static Action<int, Dictionary<string, object?>>? Sink;

        /// <summary>Where a logged value goes: the CPU's <c>KOSCoreId</c> and the value in its wire shape.</summary>
        internal static Action<int, object?>? LogSink;

        /// <summary>
        /// Builds the addon class and registers it with kOS, so every CPU created
        /// afterwards has <c>ADDONS:GONOGO</c>. Throws when this kOS lacks a member
        /// the build needs.
        /// </summary>
        public static void Register()
        {
            var addonBase = typeof(kOS.Suffixed.Addon);
            var addSuffix = typeof(Structure).GetMethod(
                "AddSuffix", BindingFlags.Instance | BindingFlags.NonPublic, null, new[] { typeof(string), typeof(ISuffix) }, null)
                ?? throw new MissingMethodException("Structure", "AddSuffix(string, ISuffix)");
            var available = addonBase.GetMethod(nameof(kOS.Suffixed.Addon.Available))
                ?? throw new MissingMethodException("Addon", "Available");
            var nomenclature = new CustomAttributeBuilder(
                typeof(KOSNomenclatureAttribute).GetConstructor(new[] { typeof(string) })!,
                new object[] { "GonogoAddon" });

            var type = KosRuntimeSubclass.Build(
                addonBase,
                typeof(SharedObjects),
                addSuffix,
                new[]
                {
                    new KeyValuePair<string, MethodInfo>("RETURN", typeof(KosGonogoAddon).GetMethod(nameof(ReturnSuffix))!),
                    new KeyValuePair<string, MethodInfo>("LOG", typeof(KosGonogoAddon).GetMethod(nameof(LogSuffix))!),
                },
                new[] { new KeyValuePair<MethodInfo, MethodInfo>(available, typeof(KosGonogoAddon).GetMethod(nameof(Available))!) },
                new[] { nomenclature });

            KOSNomenclature.PopulateType(type);
            AddonManager.RegisterMethod(new kOSAddonAttribute(Identifier), type);
        }

        /// <summary>The <c>RETURN</c> suffix for the addon built for <paramref name="shared"/>'s CPU.</summary>
        public static object ReturnSuffix(object shared) =>
            new OneArgsSuffix<Structure>(value => Return(shared, value), "Hands a LEXICON back to the dashboard that started this script.");

        /// <summary>The <c>LOG</c> suffix: hands a value to the dashboard and lets the script carry on.</summary>
        public static object LogSuffix(object shared) =>
            new OneArgsSuffix<Structure>(value => Log(shared, value), "Hands a value to the dashboard that started this script, without ending the run.");

        /// <summary>The addon's <c>AVAILABLE</c>: always true.</summary>
        public static object Available() => BooleanValue.True;

        private static void Log(object shared, Structure value)
        {
            if (shared is SharedObjects objects && objects.Processor is kOSProcessor processor)
            {
                LogSink?.Invoke(processor.KOSCoreId, KosReturnFields.ValueOf(value));
            }
        }

        private static void Return(object shared, Structure value)
        {
            var fields = KosReturnFields.From(value);
            if (shared is SharedObjects objects && objects.Processor is kOSProcessor processor)
            {
                Sink?.Invoke(processor.KOSCoreId, fields);
            }
        }
    }
}
