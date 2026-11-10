using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Zooms one camera through kerbcast's camera interface, the one path every zoom takes. Kept
    /// apart from <see cref="KerbcastUplink"/> so the routing runs headless.
    /// </summary>
    public static class KerbcastZoom
    {
        public static CommandResult Apply(IKerbcastApi kerbcast, uint cameraId, double fieldOfView)
        {
            return KerbcastAimOutcome.For(kerbcast.SetFov(cameraId, (float)fieldOfView));
        }
    }
}
