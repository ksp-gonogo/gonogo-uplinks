namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// The one file in this uplink that reaches the game.
    ///
    /// <para>Split out so the rest of <see cref="PrincipiaUplink"/> compiles with no
    /// KSP, Unity or Harmony reference: this file is simply not included in the
    /// headless test build, the partial method calls disappear, and the publish
    /// logic stays provable against a fake source. Nothing but the wiring belongs
    /// here, because anything that moves in stops being tested.</para>
    /// </summary>
    public sealed partial class PrincipiaUplink
    {
        partial void AttachObserver()
        {
            _settings ??= new PrincipiaSettingsSource();
        }

        partial void AttachGravityModel()
        {
            _gravityModel ??= new PrincipiaGravityModelSource();
        }

        partial void AttachPerturbers()
        {
            _perturbers ??= PrincipiaPerturbers.Around;
            _bodyParents ??= PrincipiaPerturbers.ParentOf;
            _bodyNames ??= PrincipiaPerturbers.NameOf;
        }

        partial void AttachSystemRequest()
        {
            SystemRequest = PrincipiaSystemSource.Read;
            GameReading = PrincipiaSystemSource.ReadGame;
            // The main body as Principia's own adapter sets it, falling back to the home body.
            FrameReading = () =>
            {
                var main = FlightGlobals.currentMainBody ?? FlightGlobals.GetHomeBody();
                return Planetarium.fetch == null || main == null
                    ? null
                    : ((double Ut, double Degrees, int MainBody)?)(
                        Planetarium.GetUniversalTime(), Planetarium.InverseRotAngle, main.flightGlobalsIndex);
            };
        }
    }
}
