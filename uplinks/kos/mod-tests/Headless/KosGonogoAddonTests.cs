// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using Gonogo.KosUplink;
using kOS;
using kOS.AddOns;
using kOS.Safe.Encapsulation;
using kOS.Safe.Utilities;
using Xunit;

namespace GonogoKosUplink.Tests.Headless
{
    /// <summary>
    /// <c>ADDONS:GONOGO</c> built and registered against the real kOS
    /// assemblies: kOS must be able to find it, name it and construct it for a
    /// CPU, and it must carry <c>RETURN</c>.
    /// </summary>
    public class KosGonogoAddonTests
    {
        private static Type RegisteredAddonType()
        {
            KosGonogoAddon.Register();
            var raw = (IDictionary)typeof(AddonManager)
                .GetField("rawAttributes", BindingFlags.NonPublic | BindingFlags.Static)!
                .GetValue(null)!;
            return raw.Keys.Cast<kOSAddonAttribute>()
                .Where(k => k.Identifier == KosGonogoAddon.Identifier)
                .Select(k => (Type)raw[k]!)
                .Last();
        }

        [Fact]
        public void Register_AddsAnAddonKosFindsAndNames()
        {
            var type = RegisteredAddonType();

            Assert.True(typeof(kOS.Suffixed.Addon).IsAssignableFrom(type));
            Assert.Equal("GonogoAddon", KOSNomenclature.GetKOSName(type));
        }

        [Fact]
        public void TheAddonConstructsForACpuWithReturnAndAvailable()
        {
            var type = RegisteredAddonType();
            var shared = (SharedObjects)RuntimeHelpers.GetUninitializedObject(typeof(SharedObjects));

            var addon = (kOS.Suffixed.Addon)Activator.CreateInstance(type, shared)!;

            Assert.True(addon.Available());
            Assert.NotNull(addon.GetSuffix("RETURN"));
            Assert.NotNull(addon.GetSuffix("LOG"));
        }
    }
}
