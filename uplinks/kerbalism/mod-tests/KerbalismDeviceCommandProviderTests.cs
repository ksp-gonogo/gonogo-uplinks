using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    public class KerbalismDeviceCommandProviderTests
    {
        private sealed class Fake : IKerbalismDeviceActuator
        {
            public string? Device;
            public bool? On;
            public string? Script;
            public bool? ScriptState;
            public int Calls;
            public CommandResult Result = CommandResult.Ok();

            public CommandResult SetDevice(string deviceId, bool on)
            {
                Calls++;
                Device = deviceId;
                On = on;
                return Result;
            }

            public CommandResult SetScriptState(string scriptType, string deviceId, bool? state)
            {
                Calls++;
                Script = scriptType;
                Device = deviceId;
                ScriptState = state;
                return Result;
            }
        }

        [Fact]
        public void DeviceSetPassesTheIdAndTheStateToTheActuator()
        {
            var fake = new Fake();
            var result = KerbalismDeviceCommandProvider.HandleDeviceSet(fake, new KerbalismDeviceSetArgs { DeviceId = "42", On = true });

            Assert.True(result.Success);
            Assert.Equal("42", fake.Device);
            Assert.True(fake.On);
        }

        [Fact]
        public void DeviceSetWithNoIdIsRefusedBeforeTheActuator()
        {
            var fake = new Fake();
            var result = KerbalismDeviceCommandProvider.HandleDeviceSet(fake, new KerbalismDeviceSetArgs { DeviceId = "" });

            Assert.False(result.Success);
            Assert.Equal(0, fake.Calls);
        }

        [Fact]
        public void DeviceSetReturnsTheActuatorsRefusalUnchanged()
        {
            var fake = new Fake { Result = CommandResult.Fail(KerbalismErrorCodes.CraftNotLoaded) };
            var result = KerbalismDeviceCommandProvider.HandleDeviceSet(fake, new KerbalismDeviceSetArgs { DeviceId = "42", On = false });

            Assert.False(result.Success);
            Assert.Equal(KerbalismErrorCodes.CraftNotLoaded, result.ErrorCode);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        [InlineData(null)]
        public void ScriptSetPassesTheEventTheDeviceAndTheThreeWayState(bool? state)
        {
            var fake = new Fake();
            var result = KerbalismDeviceCommandProvider.HandleScriptSet(
                fake, new KerbalismScriptSetArgs { ScriptType = "power_low", DeviceId = "42", State = state });

            Assert.True(result.Success);
            Assert.Equal("power_low", fake.Script);
            Assert.Equal("42", fake.Device);
            Assert.Equal(state, fake.ScriptState);
        }

        [Theory]
        [InlineData("", "42")]
        [InlineData("sunlight", "")]
        public void ScriptSetNamingNothingIsRefusedBeforeTheActuator(string script, string device)
        {
            var fake = new Fake();
            var result = KerbalismDeviceCommandProvider.HandleScriptSet(
                fake, new KerbalismScriptSetArgs { ScriptType = script, DeviceId = device });

            Assert.False(result.Success);
            Assert.Equal(0, fake.Calls);
        }
    }
}
