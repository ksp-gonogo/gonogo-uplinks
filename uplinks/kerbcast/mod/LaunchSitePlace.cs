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

        /// <summary>The first of <paramref name="candidates"/> that is set, as a place on <paramref name="bodyIndex"/>; null when none is.</summary>
        public static LaunchSitePlace? FromFirst(int bodyIndex, params (double Latitude, double Longitude)?[] candidates)
        {
            foreach (var candidate in candidates)
            {
                if (candidate.HasValue)
                {
                    return new LaunchSitePlace(bodyIndex, candidate.Value.Latitude, candidate.Value.Longitude);
                }
            }
            return null;
        }

        public int BodyIndex { get; }

        public double Latitude { get; }

        public double Longitude { get; }
    }
}
