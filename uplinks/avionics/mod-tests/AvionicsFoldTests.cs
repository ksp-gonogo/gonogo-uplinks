using GonogoAvionicsUplink;
using Xunit;

/// <summary>
/// The reduction AvionicsReflection used to hold inline beside a Vessel, where
/// no headless test could reach it. Two things are being pinned here: that the
/// per-part sum / max-across-parts shape still matches
/// <c>RP0.ControlLockerUtils.ShouldLock</c>, and that an unread reading stays
/// unread through it.
/// </summary>
public class AvionicsFoldTests
{
    private static AvionicsFold Fold() => new AvionicsFold();

    [Fact]
    public void Sums_the_limits_within_one_part()
    {
        var f = Fold();
        f.AddModule(3.0, true);
        f.AddModule(4.0, true);
        f.EndPart();

        Assert.Equal(7.0, f.Build()!.ControllableMassTons!.Value, 6);
    }

    [Fact]
    public void Takes_the_max_across_parts_rather_than_summing_them()
    {
        // ShouldLock's rule: a second, smaller unit elsewhere on the craft does
        // not add to the best part's rating.
        var f = Fold();
        f.AddModule(10.0, true);
        f.EndPart();
        f.AddModule(4.0, true);
        f.EndPart();

        Assert.Equal(10.0, f.Build()!.ControllableMassTons!.Value, 6);
    }

    [Fact]
    public void A_part_carrying_no_avionics_folds_nothing()
    {
        var f = Fold();
        f.AddModule(10.0, true);
        f.EndPart();
        f.EndPart();
        f.EndPart();

        Assert.Equal(10.0, f.Build()!.ControllableMassTons!.Value, 6);
    }

    [Fact]
    public void Reports_no_avionics_when_no_part_carried_a_module()
    {
        var f = Fold();
        f.EndPart();
        f.EndPart();

        Assert.Null(f.Build());
    }

    // The defect. An unreadable CurrentMassLimit contributed zero to the part
    // sum and was skipped silently, so the vessel's published total was a
    // PARTIAL sum wearing a total's name. AvionicsCapture then compared vessel
    // mass against that short ceiling and the widget drew NO-GO in alert tone.
    [Fact]
    public void An_unreadable_limit_leaves_the_total_unknown_not_short()
    {
        var f = Fold();
        f.AddModule(10.0, true);
        f.AddModule(null, true);
        f.EndPart();

        var raw = f.Build();
        Assert.NotNull(raw);
        Assert.Null(raw!.ControllableMassTons);
        // The vessel still HAS avionics and the switch still read, so only the
        // ceiling is unknown.
        Assert.Equal(true, raw.AvionicsActive);
    }

    // The max is what disguised it: this vessel's known parts top out at 10 t,
    // and the unreadable one could have been larger. A lower bound is not a
    // maximum.
    [Fact]
    public void An_unreadable_limit_on_any_part_leaves_the_total_unknown()
    {
        var f = Fold();
        f.AddModule(10.0, true);
        f.EndPart();
        f.AddModule(null, true);
        f.EndPart();

        Assert.Null(f.Build()!.ControllableMassTons);
    }

    // RP-1's CurrentMassLimit already returns 0 for a dead / powered-off /
    // tech-locked unit, so a zero is a READING and has to survive as one. Coming
    // out as null it would read as "nobody looked" at exactly the unit RP-1 is
    // telling us can control nothing.
    [Fact]
    public void A_zero_limit_is_a_reading_and_not_an_absence()
    {
        var f = Fold();
        f.AddModule(0.0, true);
        f.EndPart();

        var raw = f.Build();
        Assert.NotNull(raw);
        Assert.Equal(0.0, raw!.ControllableMassTons!.Value, 6);
    }

    [Fact]
    public void A_definite_switch_on_anywhere_settles_the_switch()
    {
        var f = Fold();
        f.AddModule(4.0, false);
        f.EndPart();
        f.AddModule(10.0, true);
        f.EndPart();

        Assert.Equal(true, f.Build()!.AvionicsActive);
    }

    [Fact]
    public void Every_switch_definitely_off_is_an_answer()
    {
        var f = Fold();
        f.AddModule(4.0, false);
        f.EndPart();

        Assert.Equal(false, f.Build()!.AvionicsActive);
    }

    [Fact]
    public void An_unreadable_switch_with_no_definite_on_stays_unknown()
    {
        var f = Fold();
        f.AddModule(4.0, false);
        f.AddModule(4.0, null);
        f.EndPart();

        Assert.Null(f.Build()!.AvionicsActive);
    }
}
