using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using Xunit;

/// <summary>
/// The next project RP-1 will finish, as an instant: read through RP-1's own
/// <c>GetNextThingToFinish</c>, and offered to a SCET alarm as a Topic it can
/// follow.
/// </summary>
/// <remarks>
/// Same limit as every other test in this assembly: these prove the read asks the
/// members it claims and turns the answer into an instant, and prove nothing
/// about the values a running RP-1 would hold.
/// </remarks>
[Collection("rp0-static-graph")]
public class Rp1NextCompletionTests : IDisposable
{
    public Rp1NextCompletionTests() => Reset();

    public void Dispose() => Reset();

    private static void Reset()
    {
        SpaceCenterManagement.Instance = new SpaceCenterManagement { enabledForSave = true };
        KCTUtilities.NextThing = null;
        KCTUtilities.ThrowOnNextThing = false;
    }

    [Fact]
    public void The_instant_is_the_clock_now_plus_the_projects_time_left()
    {
        KCTUtilities.NextThing = new FakeProject { Name = "Atlas 3", TimeLeft = 3_600.0 };

        var next = new Rp1ScReflection().ReadNextCompletion(1_000.0);

        Assert.NotNull(next);
        Assert.True(next!.InProgress);
        Assert.Equal(4_600.0, next.Ut);
        Assert.Equal("Atlas 3", next.Label);
    }

    [Fact]
    public void It_re_aims_when_a_shorter_project_overtakes_the_one_it_was_following()
    {
        var reflection = new Rp1ScReflection();
        KCTUtilities.NextThing = new FakeProject { Name = "Long", TimeLeft = 90_000.0 };
        var before = reflection.ReadNextCompletion(0.0);

        KCTUtilities.NextThing = new FakeProject { Name = "Short", TimeLeft = 500.0 };
        var after = reflection.ReadNextCompletion(10.0);

        Assert.Equal(90_000.0, before!.Ut);
        Assert.Equal(510.0, after!.Ut);
        Assert.Equal("Short", after.Label);
    }

    [Fact]
    public void Nothing_in_progress_is_an_answer_with_no_instant()
    {
        KCTUtilities.NextThing = null;

        var next = new Rp1ScReflection().ReadNextCompletion(1_000.0);

        Assert.NotNull(next);
        Assert.False(next!.InProgress);
        Assert.Null(next.Ut);
    }

    [Theory]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NaN)]
    [InlineData(0.0)]
    [InlineData(-5.0)]
    public void A_time_left_that_is_not_a_finite_positive_number_gives_no_instant(double timeLeft)
    {
        // RP-1's GetTimeLeft is infinity at a zero build rate; an instant made of
        // it would be a finishing time that never comes, which an alarm would
        // follow for ever.
        KCTUtilities.NextThing = new FakeProject { Name = "Stalled", TimeLeft = timeLeft };

        var next = new Rp1ScReflection().ReadNextCompletion(1_000.0);

        Assert.True(next!.InProgress);
        Assert.Null(next.Ut);
        Assert.Null(next.Label);
    }

    [Fact]
    public void A_question_RP1_cannot_answer_is_no_reading()
    {
        KCTUtilities.ThrowOnNextThing = true;

        Assert.Null(new Rp1ScReflection().ReadNextCompletion(1_000.0));
    }

    [Fact]
    public void A_save_RP1_is_not_managing_is_no_reading()
    {
        SpaceCenterManagement.Instance = new SpaceCenterManagement { enabledForSave = false };
        KCTUtilities.NextThing = new FakeProject { TimeLeft = 100.0 };

        Assert.Null(new Rp1ScReflection().ReadNextCompletion(1_000.0));
    }

    [Fact]
    public void The_channel_row_names_what_the_instant_rests_on()
    {
        var withInstant = Rp1ScCapture.BuildNextCompletion(new Rp1ScRaw
        {
            NextCompletion = new Rp1NextCompletionRaw { InProgress = true, Ut = 4_600.0, Kind = "build", Label = "Atlas 3" },
        });
        var stalled = Rp1ScCapture.BuildNextCompletion(new Rp1ScRaw
        {
            NextCompletion = new Rp1NextCompletionRaw { InProgress = true },
        });
        var idle = Rp1ScCapture.BuildNextCompletion(new Rp1ScRaw
        {
            NextCompletion = new Rp1NextCompletionRaw { InProgress = false },
        });

        Assert.Equal("next-to-finish", withInstant!["basis"]);
        Assert.Equal(4_600.0, withInstant["ut"]);
        Assert.Equal("no-estimate", stalled!["basis"]);
        Assert.Equal("none-in-progress", idle!["basis"]);
        Assert.Null(Rp1ScCapture.BuildNextCompletion(new Rp1ScRaw()));
    }

    [Fact]
    public void An_alarm_is_offered_the_topic_the_channel_publishes_with_the_game_stamp()
    {
        var source = new Rp1NextCompletionThresholdSource(
                _ => new Rp1NextCompletionRaw { InProgress = true, Ut = 4_600.0, Kind = "build", Label = "Atlas 3" })
            .Sources().Single();

        var payload = source.Build(null) as IDictionary<string, object?>;
        var meta = Assert.IsType<Dictionary<string, object?>>(payload!["meta"]);

        Assert.Equal("rp1.nextCompletion", source.Topic);
        Assert.Equal(4_600.0, payload["ut"]);
        Assert.Equal("game", meta["source"]);
    }

    [Fact]
    public void An_unreadable_queue_is_a_tick_without_a_reading_and_not_an_exception()
    {
        var source = new Rp1NextCompletionThresholdSource(_ => throw new InvalidOperationException("shape changed"))
            .Sources().Single();

        Assert.Null(source.Build(null));
    }
}
