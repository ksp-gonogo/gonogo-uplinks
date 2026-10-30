using System;
using Gonogo.KerbcastUplink;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

public class CraftPlacesTests
{
    private static readonly Guid Craft = Guid.Parse("44444444-4444-4444-4444-444444444444");

    [Fact]
    public void APlaceAtAnInstantIsTheLatestReadAtOrBeforeIt()
    {
        var places = new CraftPlaces();
        places.Learn(Craft, CraftPlace.Surface(10.0, 1, 1.0, 1.0, 1.0));
        places.Learn(Craft, CraftPlace.Surface(20.0, 1, 2.0, 2.0, 2.0));
        places.Learn(Craft, CraftPlace.Surface(30.0, 1, 3.0, 3.0, 3.0));

        Assert.True(places.TryAt(Craft, 25.0, out var at25));
        Assert.Equal(20.0, at25.Ut);
        Assert.True(places.TryAt(Craft, 30.0, out var at30));
        Assert.Equal(30.0, at30.Ut);
        Assert.False(places.TryAt(Craft, 9.9, out _));
        Assert.False(places.TryAt(Guid.NewGuid(), 25.0, out _));
    }

    [Fact]
    public void APlaceCloserThanTheSpacingToTheLastKeptOneIsIgnored()
    {
        var places = new CraftPlaces();
        places.Learn(Craft, CraftPlace.Surface(10.0, 1, 1.0, 1.0, 1.0));

        Assert.False(places.Wants(Craft, 10.5));
        places.Learn(Craft, CraftPlace.Surface(10.5, 1, 2.0, 2.0, 2.0));

        Assert.True(places.TryAt(Craft, 10.9, out var place));
        Assert.Equal(10.0, place.Ut);
        Assert.True(places.Wants(Craft, 11.0));
    }

    [Fact]
    public void AFullRecordKeepsItsOldestPlaceAndItsNewestAndCoarsensBetween()
    {
        var places = new CraftPlaces();
        for (var i = 0; i <= CraftPlaces.MaxPerCraft; i++)
        {
            places.Learn(Craft, CraftPlace.Surface(i, 1, 0.0, 0.0, 0.0));
        }

        Assert.True(places.TryAt(Craft, 0.0, out var oldest));
        Assert.Equal(0.0, oldest.Ut);
        Assert.True(places.TryAt(Craft, CraftPlaces.MaxPerCraft, out var newest));
        Assert.Equal(CraftPlaces.MaxPerCraft, newest.Ut);
        Assert.False(places.Wants(Craft, CraftPlaces.MaxPerCraft + 1.0));
        Assert.True(places.Wants(Craft, CraftPlaces.MaxPerCraft + 2.0));
    }

    [Fact]
    public void GoingBackInTimeDropsThePlacesAfterThatInstant()
    {
        var places = new CraftPlaces();
        places.Learn(Craft, CraftPlace.Surface(10.0, 1, 1.0, 1.0, 1.0));
        places.Learn(Craft, CraftPlace.Surface(20.0, 1, 2.0, 2.0, 2.0));

        places.DropAfter(15.0);

        Assert.True(places.TryAt(Craft, 100.0, out var place));
        Assert.Equal(10.0, place.Ut);
    }
}
