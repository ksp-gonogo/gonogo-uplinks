using System.Collections.Generic;
using System.Linq;
using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>What the Uplink publishes on kerbcast.craftKnowledge, and when.</summary>
public class KerbcastCraftKnowledgeFeedTests
{
    private const string Ksc = "ground:KSC";

    private static CraftKnowledgeFact Fact(uint pid, CraftKnowledgeState state, double? ut) =>
        new CraftKnowledgeFact(Ksc, pid, state, ut);

    [Fact]
    public void AnEntryNamesTheCentreTheCraftTheStateAndWhenItWasLastKnown()
    {
        var entries = new KerbcastCraftKnowledgeFeed().Next(new[] { Fact(7, CraftKnowledgeState.Modelled, 40.0) })!;

        var entry = Assert.IsType<Dictionary<string, object?>>(Assert.Single(entries));
        Assert.Equal(Ksc, entry["centre"]);
        Assert.Equal(7L, entry["craftId"]);
        Assert.Equal("modelled", entry["knowledge"]);
        Assert.Equal(40.0, entry["lastKnownUt"]);
    }

    [Theory]
    [InlineData(CraftKnowledgeState.Heard, "heard")]
    [InlineData(CraftKnowledgeState.Seen, "seen")]
    [InlineData(CraftKnowledgeState.Modelled, "modelled")]
    [InlineData(CraftKnowledgeState.Held, "held")]
    public void EachWayOfKnowingHasItsOwnWord(CraftKnowledgeState state, string word)
    {
        var entries = new KerbcastCraftKnowledgeFeed().Next(new[] { Fact(7, state, 1.0) })!;

        Assert.Equal(word, ((Dictionary<string, object?>)entries.Single())["knowledge"]);
    }

    [Fact]
    public void ACraftTheCentreKnowsNothingOfHasNoEntry()
    {
        var entries = new KerbcastCraftKnowledgeFeed().Next(new[] { Fact(7, CraftKnowledgeState.Unknown, null) })!;

        Assert.Empty(entries);
    }

    [Fact]
    public void AfterAResetWhatWasSentIsSentAgain()
    {
        var feed = new KerbcastCraftKnowledgeFeed();
        var facts = new[] { Fact(7, CraftKnowledgeState.Seen, 5.0) };
        Assert.NotNull(feed.Next(facts));
        Assert.Null(feed.Next(facts));

        feed.Reset();

        Assert.NotNull(feed.Next(facts));
    }

    [Fact]
    public void ARepeatOfWhatWasSentIsNotSentAgain()
    {
        var feed = new KerbcastCraftKnowledgeFeed();
        var facts = new[] { Fact(7, CraftKnowledgeState.Heard, 5.0) };

        Assert.NotNull(feed.Next(facts));
        Assert.Null(feed.Next(facts));
    }

    [Fact]
    public void AChangeOfStateOrOfLastKnownInstantIsSent()
    {
        var feed = new KerbcastCraftKnowledgeFeed();
        feed.Next(new[] { Fact(7, CraftKnowledgeState.Heard, 5.0) });

        Assert.NotNull(feed.Next(new[] { Fact(7, CraftKnowledgeState.Modelled, 5.0) }));
        Assert.NotNull(feed.Next(new[] { Fact(7, CraftKnowledgeState.Modelled, 6.0) }));
    }

    [Fact]
    public void KnowingNothingAfterKnowingSomethingIsSentAsAnEmptyList()
    {
        var feed = new KerbcastCraftKnowledgeFeed();
        feed.Next(new[] { Fact(7, CraftKnowledgeState.Heard, 5.0) });

        var entries = feed.Next(new List<CraftKnowledgeFact>());

        Assert.NotNull(entries);
        Assert.Empty(entries!);
    }
}
