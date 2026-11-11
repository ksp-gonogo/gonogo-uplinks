using System;
using GonogoPrincipiaUplink;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// The two analysis reads take a trailing plot-options pointer from
    /// 2026110907-Lie on. It goes across as null, which is the value that leaves the
    /// player's own analyser untouched.
    /// </summary>
    public class PlotOptionsTests
    {
        public sealed class BoxedOrbitAnalysisPlotOptions
        {
        }

        private static class Forwarder
        {
            public static object? VesselGetAnalysis(
                IntPtr plugin, string guid, object? revolutions, object? days, int revolution,
                BoxedOrbitAnalysisPlotOptions? plotOptions) => plotOptions;

            public static object? VesselGetAnalysisBefore(
                IntPtr plugin, string guid, object? revolutions, object? days, int revolution) => null;

            public static object? FlightPlanCount(IntPtr plugin, string guid, object? extra) => extra;
        }

        private static readonly object?[] AnalysisArguments = { IntPtr.Zero, "vessel-1", null, null, 1 };

        [Fact]
        public void AppendsANullToAnAnalysisReadThatTakesOne()
        {
            var method = typeof(Forwarder).GetMethod(nameof(Forwarder.VesselGetAnalysis))!;

            var args = ReflectedPrincipiaPlugin.WithPlotOptions(method, "VesselGetAnalysis", AnalysisArguments);

            Assert.Equal(6, args.Length);
            Assert.Null(args[5]);
            Assert.Null(method.Invoke(null, args));
        }

        [Fact]
        public void LeavesAnAnalysisReadThatTakesNoneAsItIs()
        {
            var method = typeof(Forwarder).GetMethod(nameof(Forwarder.VesselGetAnalysisBefore))!;

            var args = ReflectedPrincipiaPlugin.WithPlotOptions(method, "VesselGetAnalysis", AnalysisArguments);

            Assert.Same(AnalysisArguments, args);
        }

        /// <summary>Only the two named reads are padded, so a call that grew any other
        /// parameter still fails at the invoke rather than being sent a null.</summary>
        [Fact]
        public void NeverPadsAnyOtherCall()
        {
            var method = typeof(Forwarder).GetMethod(nameof(Forwarder.FlightPlanCount))!;
            var given = new object?[] { IntPtr.Zero, "vessel-1" };

            var args = ReflectedPrincipiaPlugin.WithPlotOptions(method, "FlightPlanCount", given);

            Assert.Same(given, args);
        }
    }
}
