using System;
using Gonogo.KerbcastUplink;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// How the Uplink reaches kerbcast now that it is compiled against it: the
/// compiler guards names, so what is left to test is that a kerbcast that is
/// absent, or whose surface moved under a running game, comes back as a reason
/// the Uplink can report instead of an exception on the first tick.
/// </summary>
public class KerbcastBindingTests
{
    [Fact]
    public void AnAbsentKerbcastIsAReasonAndNeverConstructsTheApi()
    {
        var constructed = false;

        var binding = KerbcastBinding.Bind(false, () =>
        {
            constructed = true;
            return new FakeKerbcastApi();
        });

        Assert.False(constructed);
        Assert.Null(binding.Api);
        Assert.Contains("not installed", binding.Reason);
    }

    [Fact]
    public void ALoadedKerbcastBindsItsApi()
    {
        var fake = new FakeKerbcastApi();

        var binding = KerbcastBinding.Bind(true, () => fake);

        Assert.Same(fake, binding.Api);
        Assert.Null(binding.Reason);
    }

    [Theory]
    [InlineData(typeof(MissingMethodException))]
    [InlineData(typeof(MissingFieldException))]
    [InlineData(typeof(TypeLoadException))]
    [InlineData(typeof(System.IO.FileNotFoundException))]
    public void AKerbcastWhoseSurfaceMovedIsAReasonNotACrash(Type failure)
    {
        var binding = KerbcastBinding.Bind(true, () => throw (Exception)Activator.CreateInstance(failure)!);

        Assert.Null(binding.Api);
        Assert.Contains("unsupported kerbcast version", binding.Reason);
        Assert.Contains(failure.Name, binding.Reason);
    }

    [Fact]
    public void AFailureThatIsNotAMovedSurfaceIsNotSwallowed()
    {
        Assert.Throws<InvalidOperationException>(() =>
            KerbcastBinding.Bind(true, () => throw new InvalidOperationException("a bug here")));
    }

    [Fact]
    public void AnAssemblyNamedKerbcastIsNotLoadedInATestProcess()
    {
        Assert.False(KerbcastBinding.IsKerbcastLoaded());
    }
}

/// <summary>What the Uplink relies on from an <see cref="IKerbcastApi"/>, shown against the fake.</summary>
public class KerbcastApiContractTests
{
    [Fact]
    public void AnAimAnswerMapsThroughTheOutcomeTheUplinkReturns()
    {
        var api = new FakeKerbcastApi { FovResult = false, PanResult = null };

        Assert.Equal(Sitrep.Contract.CommandErrorCode.NotFound, KerbcastAimOutcome.For(api.SetFov(7, 30f)).ErrorCode);
        Assert.Equal(Sitrep.Contract.CommandErrorCode.ModeUnavailable, KerbcastAimOutcome.For(api.SetPan(7, 1f, 2f)).ErrorCode);
        Assert.Equal((7u, 30f), api.LastFov);
    }

    [Fact]
    public void ASidecarThatCannotBeAskedIsNullNeverFalse()
    {
        var debouncer = new SidecarDeathDebouncer();
        var api = new FakeKerbcastApi { Sidecar = null };

        for (var i = 0; i < 20; i++)
        {
            debouncer.Observe(api.SidecarAlive());
        }

        Assert.False(debouncer.ConfirmedDead);
    }

    [Fact]
    public void AThrottleTheSaveCannotHoldIsUnreadableAndUnwritable()
    {
        var api = new FakeKerbcastApi { ThrottleReason = "no save loaded" };

        Assert.Null(api.ReadThrottle());
        Assert.False(api.WriteThrottle(true));
    }
}
