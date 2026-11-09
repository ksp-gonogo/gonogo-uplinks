using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Zooms one camera by the path its kind allows: a command camera through kerbcast's command
    /// interface under gonogo's lock, a part camera through its own camera interface. Kept apart
    /// from <see cref="KerbcastUplink"/> so the routing runs headless.
    /// </summary>
    public static class KerbcastZoom
    {
        public static CommandResult Apply(IKerbcastApi kerbcast, KerbcastLensSites lensSites, uint cameraId, string lensKey, double fieldOfView)
        {
            if (lensSites.IsCommandFeed(lensKey))
            {
                return KerbcastAimOutcome.ForCommandAim(kerbcast.SetCommandFov(cameraId, fieldOfView));
            }
            return KerbcastAimOutcome.For(kerbcast.SetFov(cameraId, (float)fieldOfView));
        }
    }
}
