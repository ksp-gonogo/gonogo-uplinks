using Gonogo.KerbcastUplink;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>A launch site is placed from the first coordinates the game has set for it.</summary>
public class LaunchSitePlaceTests
{
    [Fact]
    public void TheFirstSetCandidateIsTheSitesPlace()
    {
        var reading = LaunchSiteReading.FromFirst(1, ("PQSCity", null), ("PQSCity2", (-0.0972, -74.5577)), ("spawn point", (1.0, 2.0)));
        var place = reading.Place;
        Assert.Equal("PQSCity2", reading.Source);

        Assert.NotNull(place);
        Assert.Equal(1, place!.Value.BodyIndex);
        Assert.Equal(-0.0972, place.Value.Latitude);
        Assert.Equal(-74.5577, place.Value.Longitude);
    }

    [Fact]
    public void NoCandidateSetIsNoPlace()
    {
        var reading = LaunchSiteReading.FromFirst(1, ("PQSCity", null), ("spawn point", null));

        Assert.Null(reading.Place);
        Assert.Equal("none: no coordinates set (PQSCity, spawn point)", reading.Source);
    }
}
