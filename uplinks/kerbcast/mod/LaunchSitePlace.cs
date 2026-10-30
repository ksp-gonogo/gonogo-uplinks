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
}
