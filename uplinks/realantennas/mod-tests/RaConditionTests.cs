using System;
using System.Reflection;
using Gonogo.RealAntennasUplink;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// The antenna condition read off the module that owns the antenna. The
    /// stand-ins mirror RealAntennas 2.11.1.0's own shapes: a flags enum
    /// <c>AntennaCondition</c> (Enabled 1, Disabled 2, PermanentShutdown 4,
    /// Broken 8) held in a public <c>Condition</c> field of
    /// <c>ModuleRealAntenna</c>, which the antenna reaches through <c>Parent</c>.
    /// </summary>
    public class RaConditionTests
    {
        [Flags]
        public enum AntennaCondition
        {
            Enabled = 1,
            Disabled = 2,
            PermanentShutdown = 4,
            Broken = 8,
        }

        public sealed class Module
        {
            public AntennaCondition Condition = AntennaCondition.Enabled;
        }

        public sealed class Antenna
        {
            public object? Parent { get; set; }
        }

        private static RaReflection Reflection() =>
            (RaReflection)typeof(RaReflection)
                .GetConstructors(BindingFlags.NonPublic | BindingFlags.Instance)[0]
                .Invoke(new object[] { typeof(RaConditionTests).Assembly });

        [Theory]
        [InlineData(AntennaCondition.Enabled, "Enabled")]
        [InlineData(AntennaCondition.PermanentShutdown, "PermanentShutdown")]
        [InlineData(AntennaCondition.Disabled, "Disabled")]
        [InlineData(AntennaCondition.Enabled | AntennaCondition.Broken, "Enabled, Broken")]
        public void TheConditionIsTheNameRealAntennasGivesIt(AntennaCondition held, string expected)
        {
            var antenna = new Antenna { Parent = new Module { Condition = held } };

            Assert.Equal(expected, Reflection().Condition(antenna));
        }

        [Fact]
        public void AnAntennaWhoseModuleHasNoConditionReadsNullNotEnabled()
        {
            Assert.Null(Reflection().Condition(new Antenna { Parent = new object() }));
            Assert.Null(Reflection().Condition(new Antenna()));
        }
    }
}
