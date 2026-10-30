using Gonogo.KerbcastUplink;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>A launch site is placed from the first coordinates the game has set for it.</summary>
public class LaunchSitePlaceTests
{
    [Fact]
    public void TheFirstSetCandidateIsTheSitesPlace()
    {
        var place = LaunchSitePlace.FromFirst(1, null, (-0.0972, -74.5577), (1.0, 2.0));

        Assert.NotNull(place);
        Assert.Equal(1, place!.Value.BodyIndex);
        Assert.Equal(-0.0972, place.Value.Latitude);
        Assert.Equal(-74.5577, place.Value.Longitude);
    }

    [Fact]
    public void NoCandidateSetIsNoPlace()
    {
        Assert.Null(LaunchSitePlace.FromFirst(1, null, null, null));
    }
}
