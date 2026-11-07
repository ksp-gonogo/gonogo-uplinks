using GonogoPrincipiaUplink;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>The game's frame, recorded so a seed can be given the frame of its own instant.</summary>
    public class PrincipiaGameFrameTests
    {
        /// <summary>Kerbin's turn in the rotating frame, degrees per second: one turn in six hours.</summary>
        private const double KerbinRate = 360.0 / 21600.0;

        private const int Kerbin = 1;

        private const int Mun = 2;

        private static PrincipiaGameFrame Turning(double fromUt, double toUt, double startDegrees)
        {
            var frame = new PrincipiaGameFrame();
            for (var ut = fromUt; ut <= toUt; ut += 0.02 * 47)
            {
                frame.Adopt(ut, (startDegrees + (KerbinRate * (ut - fromUt))) % 360.0, Kerbin);
            }
            return frame;
        }

        [Fact]
        public void AnInstantInThePastGetsTheAngleTheFrameHadThen()
        {
            var frame = Turning(0.0, 7200.0, 320.0003);

            Assert.Equal(320.0003 + (KerbinRate * 1.0), frame.At(1.0)!.Value.RotationDegrees, 6);
            // An hour on, the frame has turned 60 degrees, through 360.
            Assert.Equal((320.0003 + 60.0) % 360.0, frame.At(3600.0)!.Value.RotationDegrees, 6);
            Assert.Equal(Kerbin, frame.At(3600.0)!.Value.MainBody);
        }

        [Fact]
        public void NothingIsSaidAboutAnInstantBeforeTheFirstReading()
        {
            var frame = Turning(100.0, 200.0, 10.0);

            Assert.Null(frame.At(99.0));
            Assert.Null(new PrincipiaGameFrame().At(0.0));
        }

        [Fact]
        public void AFrameThatStopsTurningKeepsBothStretches()
        {
            var frame = new PrincipiaGameFrame();
            for (var ut = 0.0; ut <= 600.0; ut += 1.0)
            {
                frame.Adopt(ut, KerbinRate * ut, Kerbin);
            }
            for (var ut = 601.0; ut <= 1200.0; ut += 1.0)
            {
                frame.Adopt(ut, KerbinRate * 600.0, Kerbin);
            }

            Assert.Equal(KerbinRate * 300.0, frame.At(300.0)!.Value.RotationDegrees, 9);
            Assert.Equal(KerbinRate * 600.0, frame.At(1000.0)!.Value.RotationDegrees, 9);
        }

        [Fact]
        public void ANewMainBodyIsKeptFromTheInstantItWasRead()
        {
            var frame = new PrincipiaGameFrame();
            for (var ut = 0.0; ut <= 100.0; ut += 1.0)
            {
                frame.Adopt(ut, 5.0, ut < 50.0 ? Kerbin : Mun);
            }

            Assert.Equal(Kerbin, frame.At(20.0)!.Value.MainBody);
            Assert.Equal(Mun, frame.At(80.0)!.Value.MainBody);
        }

        [Fact]
        public void ARevertForgetsWhatWasRecordedAfterIt()
        {
            var frame = new PrincipiaGameFrame();
            frame.Adopt(0.0, 0.0, Kerbin);
            frame.Adopt(1000.0, 90.0, Kerbin);
            frame.Adopt(500.0, 200.0, Kerbin);
            frame.Adopt(600.0, 200.0, Kerbin);

            Assert.Equal(200.0, frame.At(550.0)!.Value.RotationDegrees, 9);
        }
    }
}
