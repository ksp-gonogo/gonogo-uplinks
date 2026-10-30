namespace Gonogo.KerbcastUplink
{
    /// <summary>Where a launch site stands: its body as <c>bodies</c> numbers it, and its body-fixed latitude and longitude in degrees.</summary>
    public readonly struct LaunchSitePlace
    {
        public LaunchSitePlace(int bodyIndex, double latitude, double longitude)
        {
            BodyIndex = bodyIndex;
            Latitude = latitude;
            Longitude = longitude;
        }

        public int BodyIndex { get; }

        public double Latitude { get; }

        public double Longitude { get; }
    }

    /// <summary>What reading a launch site's place gave: the place if there is one, and which source gave it or why none did.</summary>
    public sealed class LaunchSiteReading
    {
        public LaunchSiteReading(LaunchSitePlace? place, string source)
        {
            Place = place;
            Source = source;
        }

        public LaunchSitePlace? Place { get; }

        public string Source { get; }

        /// <summary>The first of <paramref name="candidates"/> that is set, as a place on <paramref name="bodyIndex"/>; none when none is.</summary>
        public static LaunchSiteReading FromFirst(int bodyIndex, params (string Name, (double Latitude, double Longitude)? Value)[] candidates)
        {
            foreach (var candidate in candidates)
            {
                if (candidate.Value.HasValue)
                {
                    return new LaunchSiteReading(new LaunchSitePlace(bodyIndex, candidate.Value.Value.Latitude, candidate.Value.Value.Longitude), candidate.Name);
                }
            }
            return new LaunchSiteReading(null, "none: no coordinates set (" + string.Join(", ", System.Linq.Enumerable.Select(candidates, c => c.Name)) + ")");
        }
    }
}
