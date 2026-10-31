using System;
using System.Collections.Generic;
using System.Linq;
using Gonogo.KerbcastUplink;
using Kerbcast.Api;
using Kerbcast.Api.Testing;
using Sitrep.Contract;
using CraftPlace = Gonogo.KerbcastUplink.CraftPlace;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// What Kerbcast is told each feed's site knows: a station bound by its node
/// name, a craft site by the craft its lens rides, every other site unbound, and
/// in each scope only the craft that site's centre knows of.
/// </summary>
public class KerbcastWorldModelTests
{
    private const string Ksc = "ground:KSC";
    private const double Light = 299792458.0;
    private static readonly Guid ProbeId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid StationId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid HiddenId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private const uint ProbePid = 101;
    private const uint StationPid = 202;
    private const uint HiddenPid = 303;

    private readonly RecordingKerbcast _kc = new RecordingKerbcast();
    private readonly FakeLensSites _sites = new FakeLensSites();
    private readonly FakeKnowledge _knowledge = new FakeKnowledge();
    private readonly CraftLabels _labels = new CraftLabels();
    private readonly CraftPlaces _places = new CraftPlaces();
    private readonly KerbcastAuthority _authority;
    private readonly KerbcastWorldModel _model;

    public KerbcastWorldModelTests()
    {
        _authority = new KerbcastAuthority(() => _kc, _kc.Supports);
        _model = new KerbcastWorldModel(_labels, _kc.Supports, _places);
        _kc.Cameras.Learn(ProbePid, ProbeId);
        _kc.Cameras.Learn(StationPid, StationId);
        _kc.Cameras.Learn(HiddenPid, HiddenId);
        _labels.Learn(ProbePid, new CraftLabel("Probe", "Probe"));
        _labels.Learn(StationPid, new CraftLabel("Station", "Station"));
        _labels.Learn(HiddenPid, new CraftLabel("Hidden", "Ship"));
        _sites.Stations["KSC"] = Ksc;
        _kc.Command.AddFeed(new CommandFeed { FlightId = 1, SiteKey = "KSC", SiteKind = SiteKind.Station });
    }

    private PublishResult? Publish(double ut, double real)
    {
        _authority.Tick(real, Light);
        return _model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, ut, real);
    }

    [Fact]
    public void AStationFeedReadsWhatThatStationKnowsAndNothingElse()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0);
        _knowledge.Add(Ksc, HiddenId, CraftKnowledgeState.Unknown, null);

        Assert.Equal(PublishResult.Accepted, Publish(100.0, 0.0));

        var snapshot = _kc.Command.Published.Last();
        Assert.Equal(Ksc, snapshot.SiteBindings["KSC"]);
        var probe = snapshot.Find(Ksc, ProbePid);
        Assert.NotNull(probe);
        Assert.Equal(CraftFixState.Listed, probe.State);
        Assert.Equal("Probe", probe.Name);
        Assert.Equal("Probe", probe.Kind);
        Assert.Null(snapshot.Find(Ksc, HiddenPid));
        Assert.Contains((Ksc, Ksc, Ksc), _sites.Bound);
        Assert.Equal(100.0, _knowledge.AskedAt[Ksc]);
    }

    [Fact]
    public void ACraftsPlaceAndRadiusAreLoggedOnceAndAgainWhenTheyChange()
    {
        var lines = new List<string>();
        _kc.Command.SetTargets(1, new[] { new CommandTarget { PersistentId = ProbePid, Eligibility = "tooUncertain", RangeM = 448.0 } });
        var model = new KerbcastWorldModel(_labels, _kc.Supports, _places, lines.Add);
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0, 250.0);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 99.0, 900.0);

        _authority.Tick(0.0, Light);
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 0.0);
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 5.0);

        Assert.Contains(lines, l => l.StartsWith("[Kerbcast][WORLD]") && l.Contains("craft=" + ProbePid) && l.Contains("positioned") && l.Contains("radiusM=250"));
        Assert.Contains(lines, l => l.Contains("craft=" + StationPid) && l.Contains("listed"));
        Assert.Equal(2, lines.Count(l => l.Contains("scope=")));
        Assert.Contains(lines, l => l.Contains("feed=1") && l.Contains("craft=" + ProbePid) && l.Contains("eligibility=tooUncertain") && l.Contains("rangeM=448"));
    }

    [Fact]
    public void ARecordLineIsWrittenWhenTheRadiusMovesByMoreThanFivePercentAndNotBefore()
    {
        var lines = new List<string>();
        var model = new KerbcastWorldModel(_labels, _kc.Supports, _places, lines.Add);
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));
        double radius = 200.0;
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, _ => 99.0, _ => radius);

        _authority.Tick(0.0, Light);
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 0.0);
        radius = 205.0;
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 5.0);
        radius = 260.0;
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 10.0);

        var records = lines.Where(l => l.StartsWith("[Kerbcast][RECORD]")).ToList();
        Assert.Equal(2, records.Count);
        Assert.Contains("craft=" + ProbePid, records[0]);
        Assert.Contains("radiusM=200", records[0]);
        Assert.Contains("lastKnownUt=99", records[0]);
        Assert.Contains("version=", records[0]);
        Assert.Contains("aheadVersion=", records[0]);
        Assert.Contains("radiusM=260", records[1]);
    }

    private void PublishAt(double ut, double real)
    {
        _sites.Delivered[Ksc] = ut;
        Publish(ut, real);
    }

    private (double Radius, double Rate, double From) Record(int fromEnd)
    {
        var probe = _kc.Command.Published[^fromEnd].Find(Ksc, ProbePid);
        return (probe.UncertaintyRadiusM, probe.RateMps, probe.ValidFromUt);
    }

    /// <summary>The bound of a craft whose capture is <paramref name="age"/> seconds old, as the centre grows it: 20 m/s² for as long as it has been.</summary>
    private static double Bound(double age) => 0.5 * 20.0 * age * age;

    [Theory]
    [InlineData(1.0)]
    [InlineData(3.0)]
    [InlineData(5.0)]
    public void ARecordHoldsTheCraftFromItsStartToItsReplacementWhateverTheAgeOfTheCapture(double age)
    {
        _places.Learn(ProbeId, CraftPlace.Surface(100.0 - age, 1, 0.0, 0.0, 70.0));
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, ut => 100.0 - age, ut => Bound(age + (ut - 100.0)));

        PublishAt(100.0, 0.0);

        var record = Record(1);
        Assert.Equal(0.0, record.Rate);
        for (var later = 0.0; later <= 1.0; later += 0.25)
        {
            Assert.True(record.Radius >= Bound(age + later) - 1e-9, $"age {age} s, {later} s into the record: {record.Radius:F1} m against {Bound(age + later):F1} m");
        }
    }

    [Fact]
    public void ARecordIsTheSameFromOneSecondToTheNextWhileTheCaptureStaysAsOldAsItWas()
    {
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));
        var capture = 99.0;
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, ut => capture, ut => Bound(ut - capture));

        PublishAt(100.0, 0.0);
        capture = 100.0;
        PublishAt(101.0, 5.0);
        capture = 101.0;
        PublishAt(102.0, 10.0);

        Assert.Equal(Record(3).Radius, Record(2).Radius);
        Assert.Equal(Record(2).Radius, Record(1).Radius);
        Assert.Equal(Bound(2.0), Record(1).Radius);
    }

    [Fact]
    public void APredictedRecordCarriesTheRadiusAtTheEndOfItsLifeAndNoRate()
    {
        _places.Learn(ProbeId, CraftPlace.Surface(50.0, 1, 9.0, 9.0, 9.0));
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, ut => 99.0, ut => Bound(ut - 99.0), MovingAlong(Sitrep.Contract.CraftPlaceBasis.Burning, 1000.0, 10.0));

        PublishAt(100.0, 0.0);

        var record = Record(1);
        Assert.Equal(Bound(2.0), record.Radius);
        Assert.Equal(0.0, record.Rate);
        Assert.Equal(100.0, record.From);
    }

    [Fact]
    public void ARecordNeverSettlesBelowTheBoundNowWhenTheReadAMomentLaterCameFromANewerCapture()
    {
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, ut => ut < 100.5 ? 99.0 : 100.4, ut => ut < 100.5 ? 130.0 : 5.0);

        PublishAt(100.0, 0.0);

        Assert.Equal(130.0, Record(1).Radius);
    }

    private const double KerbinMu = 3.5316e12;

    /// <summary>A craft 2 km up at 6 m/s down under a parachute, turning with the planet at 175 m/s: its drag holds it at a steady speed, so it moves in a straight line.</summary>
    private static Sitrep.Contract.CraftPlace? Terminal(double ut) =>
        new Sitrep.Contract.CraftPlace(1, new Vector3d(602_000.0 - 6.0 * (ut - 100.0), 175.0 * (ut - 100.0), 0.0), Sitrep.Contract.CraftPlaceBasis.Burning);

    /// <summary>Where Kerbcast puts a record's craft <paramref name="seconds"/> into it: the start and velocity carried on under the body's gravity and nothing else.</summary>
    private static double[] KerbcastCarries(Vec3d position, Vec3d speed, double seconds)
    {
        var start = new[] { position.X, position.Y, position.Z };
        var velocity = new[] { speed.X, speed.Y, speed.Z };
        var r = Math.Sqrt(start[0] * start[0] + start[1] * start[1] + start[2] * start[2]);
        var at = new double[3];
        for (var i = 0; i < 3; i++)
        {
            at[i] = start[i] + velocity[i] * seconds - 0.5 * KerbinMu * start[i] / (r * r * r) * seconds * seconds;
        }
        return at;
    }

    private static double Gap(double[] carried, Sitrep.Contract.CraftPlace truth)
    {
        var dx = carried[0] - truth.Position.X;
        var dy = carried[1] - truth.Position.Y;
        var dz = carried[2] - truth.Position.Z;
        return Math.Sqrt(dx * dx + dy * dy + dz * dz);
    }

    [Fact]
    public void KerbcastsGravityAloneNeverCarriesACraftAtTerminalSpeedFurtherThanTheRecordsRadiusFromWhereItIs()
    {
        var model = new KerbcastWorldModel(_labels, _kc.Supports, _places, bodyMu: _ => KerbinMu);
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, ut => 99.0, ut => 2.0, Terminal);

        _authority.Tick(0.0, Light);
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 0.0);

        var record = _kc.Command.Published.Last().Find(Ksc, ProbePid);
        for (var seconds = 0.0; seconds <= 1.0; seconds += 0.25)
        {
            var gap = Gap(KerbcastCarries(record.Position, record.Velocity, seconds), Terminal(100.0 + seconds)!);
            Assert.True(gap <= record.UncertaintyRadiusM, $"{seconds} s into the record: {gap:F2} m off, radius {record.UncertaintyRadiusM:F2} m");
        }
        // It meets the craft where the record is replaced, where gravity alone would be 4.9 m off, and is a quarter of that off in the middle.
        Assert.True(Gap(KerbcastCarries(record.Position, record.Velocity, 1.0), Terminal(101.0)!) < 0.05);
        Assert.True(Gap(KerbcastCarries(record.Position, record.Velocity, 0.5), Terminal(100.5)!) < 9.745 / 8.0 + 0.05);
    }

    [Fact]
    public void WithNoBodyToTakeGravityFromTheVelocityIsThePlacesOwnMotionAndKerbcastsGravityLeavesTheCraftAboveItsAim()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, ut => 99.0, ut => 2.0, Terminal);

        Publish(100.0, 0.0);

        var record = _kc.Command.Published.Last().Find(Ksc, ProbePid);
        // Half g t² at one second: the aim falls 4.9 m below a craft that does not fall.
        Assert.Equal(4.87, Gap(KerbcastCarries(record.Position, record.Velocity, 1.0), Terminal(101.0)!), 1);
    }

    [Fact]
    public void ARecordCarriesTheCraftsOwnSizeAsItsRadiusAndALeftOutSizeLeavesKerbcastItsNominalOne()
    {
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));
        _knowledge.AddByUt(Ksc, ProbeId, CraftKnowledgeState.Heard, ut => 99.0, ut => 2.0, Terminal, extentM: 11.5);
        _knowledge.AddByUt(Ksc, StationId, CraftKnowledgeState.Heard, ut => 99.0, ut => 2.0, Terminal);
        _places.Learn(StationId, CraftPlace.Surface(99.0, 1, 0.0, 0.0, 70.0));

        PublishAt(100.0, 0.0);

        var snapshot = _kc.Command.Published.Last();
        Assert.Equal(11.5, snapshot.Find(Ksc, ProbePid).RadiusM);
        Assert.True(double.IsNaN(snapshot.Find(Ksc, StationPid).RadiusM));
        Assert.True(snapshot.Find(Ksc, ProbePid).UncertaintyRadiusM < 11.5);
    }

    private static Func<double, Sitrep.Contract.CraftPlace?> MovingAlong(Sitrep.Contract.CraftPlaceBasis basis, double x0, double speed) =>
        ut => new Sitrep.Contract.CraftPlace(1, new Vector3d(x0 + speed * ut, 2.0, 3.0), basis);

    [Theory]
    [InlineData(Sitrep.Contract.CraftPlaceBasis.Coasting, 0.0)]
    [InlineData(Sitrep.Contract.CraftPlaceBasis.Burning, 400.0)]
    public void ACraftWithAPredictedPlaceIsAimedAtThatPlaceWithItsRadiusAtTheInstantRead(Sitrep.Contract.CraftPlaceBasis basis, double radiusM)
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(50.0, 1, 9.0, 9.0, 9.0));
        _knowledge.AddWithPlace(Ksc, ProbeId, CraftKnowledgeState.Heard, 50.0, radiusM, MovingAlong(basis, 1000.0, 10.0));

        Publish(100.0, 0.0);

        var probe = _kc.Command.Published.Last().Find(Ksc, ProbePid);
        Assert.NotNull(probe);
        Assert.Equal(CraftFixState.Positioned, probe.State);
        Assert.Equal(KinematicsKind.StateVector, probe.Kinematics);
        Assert.Equal(1, probe.BodyIndex);
        Assert.Equal(100.0, probe.StateUt);
        Assert.Equal(2000.0, probe.Position.X);
        Assert.Equal(10.0, probe.Velocity.X);
        Assert.Equal(radiusM, probe.UncertaintyRadiusM);
    }

    [Fact]
    public void ACraftWithNoPredictedPlaceKeepsTheLastRecordedPlaceAndNothingReadsThePresent()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(50.0, 1, 9.0, 9.0, 9.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 50.0, 250.0);

        Publish(100.0, 0.0);

        var probe = _kc.Command.Published.Last().Find(Ksc, ProbePid);
        Assert.NotNull(probe);
        Assert.Equal(CraftFixState.Positioned, probe.State);
        Assert.Equal(50.0, probe.ValidFromUt);
        Assert.Equal(250.0, probe.UncertaintyRadiusM);
    }

    [Fact]
    public void ACraftWithAPredictedPlaceNeedsNoPlaceOnRecord()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.AddWithPlace(Ksc, ProbeId, CraftKnowledgeState.Heard, 50.0, 0.0, MovingAlong(Sitrep.Contract.CraftPlaceBasis.Coasting, 0.0, 1.0));

        Publish(100.0, 0.0);

        Assert.Equal(CraftFixState.Positioned, _kc.Command.Published.Last().Find(Ksc, ProbePid)!.State);
    }

    [Fact]
    public void ACraftWithAPredictedPlaceButNoRadiusListsInstead()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.AddWithPlace(Ksc, ProbeId, CraftKnowledgeState.Heard, 50.0, null, MovingAlong(Sitrep.Contract.CraftPlaceBasis.Coasting, 0.0, 1.0));

        Publish(100.0, 0.0);

        Assert.Equal(CraftFixState.Listed, _kc.Command.Published.Last().Find(Ksc, ProbePid)!.State);
    }

    [Fact]
    public void EveryCommandFeedReportsTheCentreItsLensStandsAtEvenWhenTwoShareASite()
    {
        IReadOnlyDictionary<string, string>? reported = null;
        var model = new KerbcastWorldModel(_labels, _kc.Supports, _places, null, sites => reported = sites);
        _kc.Command.AddFeed(new CommandFeed { FlightId = 7, SiteKey = "KSC", SiteKind = SiteKind.Station });
        _kc.Command.AddFeed(new CommandFeed { FlightId = 8, SiteKey = "Unknown", SiteKind = SiteKind.Station });
        _sites.Delivered[Ksc] = 100.0;

        _authority.Tick(0.0, Light);
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 0.0);

        Assert.NotNull(reported);
        Assert.Equal(Ksc, reported!["1"]);
        Assert.Equal(Ksc, reported["7"]);
        Assert.False(reported.ContainsKey("8"));
    }

    [Fact]
    public void ALaunchSiteFeedIsBoundToTheStationNearestItAndItsLensIsPlaced()
    {
        IReadOnlyDictionary<string, string>? reported = null;
        var log = new List<string>();
        var model = new KerbcastWorldModel(
            _labels,
            _kc.Supports,
            _places,
            log.Add,
            sites => reported = sites,
            name => name == "LaunchPad" ? new LaunchSiteReading(new LaunchSitePlace(1, -0.09, -74.55), "PQSCity") : new LaunchSiteReading(null, "none: the game has no launch site of that name"));
        _sites.Near.Add((1, -0.1, -74.6, Ksc));
        _kc.Command.AddFeed(new CommandFeed { FlightId = 5, SiteKey = "LaunchPad", SiteKind = SiteKind.LaunchSite });
        _kc.Command.AddFeed(new CommandFeed { FlightId = 6, SiteKey = "Island Runway", SiteKind = SiteKind.LaunchSite });
        _sites.Delivered[Ksc] = 100.0;

        _authority.Tick(0.0, Light);
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, 100.0, 0.0);

        Assert.Equal(Ksc, _kc.Command.Published.Last().SiteBindings["LaunchPad"]);
        Assert.Equal(Ksc, reported!["5"]);
        Assert.False(reported.ContainsKey("6"));
        Assert.False(_kc.Command.Published.Last().SiteBindings.ContainsKey("Island Runway"));
        Assert.Contains(log, l => l == "[Kerbcast][WORLD] launch-site feed=5 site=LaunchPad source=PQSCity body=1 lat=-0.09 lon=-74.55 near=" + Ksc);
        Assert.Contains(log, l => l == "[Kerbcast][WORLD] launch-site feed=6 site=Island Runway none: the game has no launch site of that name near=none");
    }

    private KerbcastWorldModel FollowingModel(Func<uint?> active, List<string>? log = null) =>
        new KerbcastWorldModel(_labels, _kc.Supports, _places, log == null ? null : log.Add, null, null, active);

    private void PublishWith(KerbcastWorldModel model, double ut, double real)
    {
        _authority.Tick(real, Light);
        model.Publish(_kc, _authority.Publisher!, _authority.Tenure, _sites, _knowledge, ut, real);
    }

    private void Judge(uint craft, string eligibility) =>
        _kc.Command.SetTargets(1, new[] { new CommandTarget { PersistentId = craft, Eligibility = eligibility } });

    private int AimCalls() => _kc.Calls.Count(c => c.StartsWith("SetAim", StringComparison.Ordinal));

    [Fact]
    public void ACommandFeedFollowsTheActiveCraftOnceItIsHeardAndInView()
    {
        var log = new List<string>();
        var model = FollowingModel(() => ProbePid, log);
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0, 250.0);
        Judge(ProbePid, "ok");

        PublishWith(model, 100.0, 0.0);
        PublishWith(model, 100.1, 0.1);

        Assert.Equal(ProbePid, _kc.Command.Aims[1].SubjectPersistentId);
        Assert.Equal(1, AimCalls());
        Assert.Contains(log, l => l.Contains("follow feed=1 subject=" + ProbePid));
    }

    [Theory]
    [InlineData(CraftKnowledgeState.Seen, "ok")]
    [InlineData(CraftKnowledgeState.Heard, "tooUncertain")]
    [InlineData(CraftKnowledgeState.Heard, "notPositioned")]
    public void ACraftNotHeardOrNotInViewIsNotFollowed(CraftKnowledgeState state, string eligibility)
    {
        var model = FollowingModel(() => ProbePid);
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, state, 99.0, 250.0);
        Judge(ProbePid, eligibility);

        PublishWith(model, 100.0, 0.0);

        Assert.Equal(0, AimCalls());
    }

    [Fact]
    public void OnlyTheActiveCraftIsFollowedAndNoActiveCraftFollowsNothing()
    {
        uint? active = StationPid;
        var model = FollowingModel(() => active);
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0, 250.0);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 99.0, 250.0);
        _kc.Command.SetTargets(1, new[]
        {
            new CommandTarget { PersistentId = ProbePid, Eligibility = "ok" },
            new CommandTarget { PersistentId = StationPid, Eligibility = "ok" },
        });

        PublishWith(model, 100.0, 0.0);
        Assert.Equal(StationPid, _kc.Command.Aims[1].SubjectPersistentId);

        active = null;
        PublishWith(model, 100.1, 0.1);
        Assert.Equal(1, AimCalls());

        active = ProbePid;
        PublishWith(model, 100.2, 0.2);
        Assert.Equal(ProbePid, _kc.Command.Aims[1].SubjectPersistentId);
        Assert.Equal(2, AimCalls());
    }

    [Fact]
    public void ACraftThatStopsQualifyingIsAimedAtAgainWhenItQualifiesAgain()
    {
        var model = FollowingModel(() => ProbePid);
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0, 250.0);
        Judge(ProbePid, "ok");
        PublishWith(model, 100.0, 0.0);

        Judge(ProbePid, "tooUncertain");
        PublishWith(model, 100.1, 0.1);
        Judge(ProbePid, "ok");
        PublishWith(model, 100.2, 0.2);

        Assert.Equal(2, AimCalls());
    }

    [Fact]
    public void AStationWhoseNameIsNotOneStationIsLeftUnboundSoItFailsClosed()
    {
        _kc.Command.AddFeed(new CommandFeed { FlightId = 2, SiteKey = "Twin", SiteKind = SiteKind.Station });
        _kc.Command.AddFeed(new CommandFeed { FlightId = 3, SiteKey = "Field", SiteKind = SiteKind.Surface });
        _sites.Delivered[Ksc] = 100.0;

        Publish(100.0, 0.0);

        var bindings = _kc.Command.Published.Last().SiteBindings;
        Assert.False(bindings.ContainsKey("Twin"));
        Assert.False(bindings.ContainsKey("Field"));
        Assert.Single(bindings);
    }

    [Fact]
    public void ACraftSiteIsBoundToTheCentreOfTheCraftItsLensRides()
    {
        _kc.Cameras.Learn(StationPid, StationId);
        _kc.Command.AddFeed(new CommandFeed { FlightId = 4, SiteKey = "vessel:202", SiteKind = SiteKind.Vessel, VantagePersistentId = StationPid });

        Publish(100.0, 0.0);

        Assert.Equal("vessel:" + StationId, _kc.Command.Published.Last().SiteBindings["vessel:202"]);
    }

    [Fact]
    public void AScopeNothingHasReachedYetHoldsNoCraft()
    {
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0);

        Publish(100.0, 0.0);

        var snapshot = _kc.Command.Published.Last();
        Assert.Equal(Ksc, snapshot.SiteBindings["KSC"]);
        Assert.Empty(snapshot.Records);
    }

    [Fact]
    public void ACraftWithoutAKnownPersistentIdIsLeftOut()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, Guid.Parse("44444444-4444-4444-4444-444444444444"), CraftKnowledgeState.Heard, 99.0);

        Publish(100.0, 0.0);

        Assert.Empty(_kc.Command.Published.Last().Records);
    }

    [Fact]
    public void AKerbcastWithoutCraftIdentityListsNoCraft()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0);
        _kc.SetSupported(f => f != ApiFeature.CraftIdentity);

        Publish(100.0, 0.0);

        Assert.Empty(_kc.Command.Published.Last().Records);
    }

    [Fact]
    public void ARetakenLockGetsAFreshPublisherThatIsAccepted()
    {
        _sites.Delivered[Ksc] = 100.0;
        Assert.Equal(PublishResult.Accepted, Publish(100.0, 0.0));

        _authority.Tick(0.1, null);
        Assert.Equal(PublishResult.Accepted, Publish(100.2, 0.2));
        Assert.True(_authority.Tenure >= 2);
    }

    [Fact]
    public void ADockIsAliasedOnlyOnceTheCentreHasHeardFromTheCraftItJoined()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 99.0);
        _model.OnIdentity(new IdentityEvent(change: IdentityChange.Merge, ut: 100.0, persistentId: ProbePid, vesselId: ProbeId, otherPersistentId: StationPid, otherVesselId: StationId));

        Publish(100.0, 0.0);
        Assert.Empty(_kc.Command.Published.Last().Aliases);

        _knowledge.Clear();
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Held, 99.9);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 104.0);
        _sites.Delivered[Ksc] = 105.0;
        Publish(105.0, 0.5);

        var alias = Assert.Single(_kc.Command.Published.Last().Aliases);
        Assert.Equal(ProbePid, alias.Key);
        Assert.Equal(StationPid, alias.Value);
    }

    [Fact]
    public void AnUndockUndoesTheAliasOnceHeardSoARedockIsAcceptedAgain()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 101.0);
        _model.OnIdentity(Change(IdentityChange.Merge, 100.0, ProbePid, StationPid));
        Publish(101.0, 0.0);
        Assert.Single(_kc.Command.Published.Last().Aliases);

        _model.OnIdentity(Change(IdentityChange.Split, 110.0, ProbePid, StationPid));
        _model.OnIdentity(Change(IdentityChange.Merge, 120.0, ProbePid, StationPid));
        _knowledge.Version++;
        Assert.Equal(PublishResult.Accepted, Publish(111.0, 0.5));
        Assert.Single(_kc.Command.Published.Last().Aliases);

        _knowledge.Clear();
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 115.0);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 115.0);
        Assert.Equal(PublishResult.Accepted, Publish(115.0, 1.0));
        Assert.Empty(_kc.Command.Published.Last().Aliases);

        _knowledge.Clear();
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Held, 119.0);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 125.0);
        Assert.Equal(PublishResult.Accepted, Publish(125.0, 1.5));
        Assert.Single(_kc.Command.Published.Last().Aliases);
    }

    [Fact]
    public void AnAliasKerbcastWouldRefuseIsLeftOutAndTheSnapshotIsAccepted()
    {
        _sites.Delivered[Ksc] = 100.0;
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 105.0);
        _knowledge.Add(Ksc, StationId, CraftKnowledgeState.Heard, 105.0);
        _model.OnIdentity(Change(IdentityChange.Merge, 100.0, ProbePid, StationPid));
        _model.OnIdentity(Change(IdentityChange.Merge, 101.0, StationPid, ProbePid));
        _model.OnIdentity(Change(IdentityChange.Merge, 102.0, ProbePid, HiddenPid));

        Assert.Equal(PublishResult.Accepted, Publish(105.0, 0.0));

        var alias = Assert.Single(_kc.Command.Published.Last().Aliases);
        Assert.Equal(new KeyValuePair<uint, uint>(ProbePid, StationPid), alias);
    }

    private PublishedRecord ProbeRecord()
    {
        var record = _kc.Command.Published.Last().Find(Ksc, ProbePid);
        Assert.NotNull(record);
        return record;
    }

    [Fact]
    public void AHeardCraftIsPositionedWhereTheGameHadItWhenItWasLastHeard()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(90.0, 1, -0.0972, -74.5577, 70.0));
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, -0.0972, -74.5577, 71.0));
        _places.Learn(ProbeId, CraftPlace.Surface(100.0, 1, 5.0, 5.0, 5.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.5, 12.0);

        Publish(100.0, 0.0);

        var probe = ProbeRecord();
        Assert.Equal(CraftFixState.Positioned, probe.State);
        Assert.Equal(KinematicsKind.Surface, probe.Kinematics);
        Assert.Equal(1, probe.BodyIndex);
        Assert.Equal(-0.0972, probe.Latitude);
        Assert.Equal(71.0, probe.Altitude);
        Assert.Equal(99.0, probe.ValidFromUt);
        Assert.True(probe.HasUncertainty);
        Assert.Equal(12.0, probe.UncertaintyRadiusM);
        Assert.Equal("Probe", probe.Name);
    }

    [Fact]
    public void ASeenCraftIsPositionedTheSameWay()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(90.0, 1, 1.0, 2.0, 3.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Seen, 95.0, 40.0);

        Publish(100.0, 0.0);

        var probe = ProbeRecord();
        Assert.Equal(CraftFixState.Positioned, probe.State);
        Assert.Equal(40.0, probe.UncertaintyRadiusM);
    }

    [Fact]
    public void AModelledCraftIsPositionedOnTheCourseItWasHoldingWhenLastKnown()
    {
        _sites.Delivered[Ksc] = 500.0;
        _places.Learn(ProbeId, CraftPlace.State(60.0, 2, 1000.0, 2000.0, 3000.0, 4.0, 5.0, 6.0));
        _places.Learn(ProbeId, CraftPlace.State(400.0, 2, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Modelled, 100.0, 8000.0);

        Publish(500.0, 0.0);

        var probe = ProbeRecord();
        Assert.Equal(CraftFixState.Positioned, probe.State);
        Assert.Equal(KinematicsKind.StateVector, probe.Kinematics);
        Assert.Equal(2, probe.BodyIndex);
        Assert.Equal(60.0, probe.StateUt);
        Assert.Equal(new Vec3d(1000.0, 2000.0, 3000.0), probe.Position);
        Assert.Equal(new Vec3d(4.0, 5.0, 6.0), probe.Velocity);
        Assert.Equal(8000.0, probe.UncertaintyRadiusM);
    }

    [Fact]
    public void AHeldCraftStaysListedWhateverTheGameHadForIt()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(90.0, 1, 1.0, 2.0, 3.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Held, 95.0, 40.0);

        Publish(100.0, 0.0);

        Assert.Equal(CraftFixState.Listed, ProbeRecord().State);
    }

    [Fact]
    public void ACraftWhoseUncertaintyCannotBeBoundedStaysListed()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(90.0, 1, 1.0, 2.0, 3.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 95.0, null);

        Publish(100.0, 0.0);

        Assert.Equal(CraftFixState.Listed, ProbeRecord().State);
    }

    [Fact]
    public void ACraftWithNoPlaceOnRecordThatEarlyStaysListed()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(99.0, 1, 1.0, 2.0, 3.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 95.0, 10.0);

        Publish(100.0, 0.0);

        Assert.Equal(CraftFixState.Listed, ProbeRecord().State);
    }

    [Fact]
    public void APlaceReadAfterAGameLoadIsNotCarriedIntoTheNewTimeline()
    {
        _sites.Delivered[Ksc] = 100.0;
        _places.Learn(ProbeId, CraftPlace.Surface(90.0, 1, 1.0, 2.0, 3.0));
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 95.0, 10.0);

        _model.OnGameLoaded();
        Publish(100.0, 0.0);

        Assert.Equal(CraftFixState.Listed, ProbeRecord().State);
    }

    private static IdentityEvent Change(IdentityChange change, double ut, uint pid, uint other) =>
        new IdentityEvent(change: change, ut: ut, persistentId: pid, vesselId: Guid.Empty, otherPersistentId: other);

    [Fact]
    public void ARenumberedCraftIsAliasedAtOnceAndKeepsItsLabel()
    {
        _sites.Delivered[Ksc] = 100.0;
        _model.OnIdentity(new IdentityEvent(change: IdentityChange.Renumber, ut: 100.0, persistentId: ProbePid, vesselId: ProbeId, otherPersistentId: 999, otherVesselId: ProbeId));
        _kc.Cameras.Learn(999, ProbeId);
        _knowledge.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0);

        Publish(100.0, 0.0);

        var snapshot = _kc.Command.Published.Last();
        Assert.Contains(new KeyValuePair<uint, uint>(ProbePid, 999), snapshot.Aliases);
        Assert.Equal("Probe", snapshot.Find(Ksc, 999)?.Name);
    }

    [Fact]
    public void TimeGoingBackwardsRaisesTheEpochAndDropsWhatHappenedAfterIt()
    {
        _sites.Delivered[Ksc] = 200.0;
        _model.OnIdentity(new IdentityEvent(change: IdentityChange.Renumber, ut: 150.0, persistentId: ProbePid, vesselId: ProbeId, otherPersistentId: 999, otherVesselId: ProbeId));
        Publish(200.0, 0.0);
        var before = _kc.Command.Published.Last();

        Assert.Equal(PublishResult.Accepted, Publish(120.0, 0.1));

        var after = _kc.Command.Published.Last();
        Assert.True(after.Epoch > before.Epoch);
        Assert.Empty(after.Aliases);
    }

    [Fact]
    public void AGameLoadRaisesTheEpoch()
    {
        Publish(100.0, 0.0);
        var before = _kc.Command.Published.Last().Epoch;

        _model.OnGameLoaded();
        Publish(100.0, 0.1);

        Assert.True(_kc.Command.Published.Last().Epoch > before);
    }

    [Fact]
    public void NothingIsPublishedAgainUntilSomethingChangesOrTheRefreshComesRound()
    {
        _sites.Delivered[Ksc] = 100.0;
        Assert.NotNull(Publish(100.0, 0.0));
        Assert.Null(Publish(100.5, 0.5));

        _knowledge.Version++;
        Assert.NotNull(Publish(101.0, 0.6));

        Assert.Null(Publish(101.5, 1.0));
        Assert.NotNull(Publish(103.0, 0.6 + KerbcastWorldModel.RefreshSeconds));
    }

    [Fact]
    public void ASiteNoLongerAnyFeedsIsUnboundFromItsLensSite()
    {
        _sites.Delivered[Ksc] = 100.0;
        Publish(100.0, 0.0);

        var empty = new RecordingKerbcast();
        var authority = new KerbcastAuthority(() => empty, empty.Supports);
        authority.Tick(0.1, Light);
        _model.Publish(empty, authority.Publisher!, authority.Tenure, _sites, _knowledge, 100.1, 0.1);

        Assert.Contains((Ksc, Ksc), _sites.Unbound);
    }

    [Fact]
    public void WithoutLensSitesOrKnowledgeEveryFeedReadsEveryCraftAsUnknown()
    {
        _authority.Tick(0.0, Light);
        _model.Publish(_kc, _authority.Publisher!, _authority.Tenure, null, null, 100.0, 0.0);

        var snapshot = _kc.Command.Published.Last();
        Assert.Empty(snapshot.SiteBindings);
        Assert.Empty(snapshot.Records);
    }

    private sealed class FakeLensSites : ILensSites
    {
        public readonly Dictionary<string, string> Stations = new Dictionary<string, string>();
        public readonly Dictionary<string, double> Delivered = new Dictionary<string, double>();
        public readonly List<(string Scope, string Site, string Centre)> Bound = new();
        public readonly List<(string Scope, string Site)> Unbound = new();

        public string ProviderId => "fake-lens-sites";

        public string? GroundStationNamed(string nodeName) => Stations.TryGetValue(nodeName, out var id) ? id : null;

        public readonly List<(int Body, double Latitude, double Longitude, string Id)> Near = new();

        public string? GroundStationNear(int bodyIndex, double latitude, double longitude) =>
            Near.Where(n => n.Body == bodyIndex && Math.Abs(n.Latitude - latitude) < 1.0 && Math.Abs(n.Longitude - longitude) < 1.0)
                .Select(n => n.Id).FirstOrDefault();

        public void Bind(string scope, string site, string commandingCentre) => Bound.Add((scope, site, commandingCentre));

        public void Unbind(string scope, string site) => Unbound.Add((scope, site));

        public double? KnowledgeUt(string scope) => Delivered.TryGetValue(scope, out var ut) ? ut : null;
    }

    private sealed class FakeKnowledge : IBulkCraftKnowledge
    {
        private readonly Dictionary<string, List<Func<double, CraftKnowledgeSample>>> _byCentre = new();
        public readonly Dictionary<string, double> AskedAt = new();

        public string ProviderId => "fake-knowledge";

        public long Version { get; set; } = 1;

        public void Add(string centre, Guid vessel, CraftKnowledgeState state, double? lastKnownUt, double? uncertaintyM = null)
        {
            AddWithPlace(centre, vessel, state, lastKnownUt, uncertaintyM, null);
        }

        /// <summary>Adds a craft whose predicted place is asked of <paramref name="place"/> at whatever instant is read.</summary>
        public void AddWithPlace(string centre, Guid vessel, CraftKnowledgeState state, double? lastKnownUt, double? uncertaintyM, Func<double, Sitrep.Contract.CraftPlace?>? place)
        {
            if (!_byCentre.TryGetValue(centre, out var list))
            {
                _byCentre[centre] = list = new List<Func<double, CraftKnowledgeSample>>();
            }
            list.Add(ut => new CraftKnowledgeSample(vessel.ToString(), state, null, lastKnownUt, uncertaintyM, false, place?.Invoke(ut)));
        }

        /// <summary>Adds a craft whose last known instant and uncertainty are asked of the two functions at whatever instant is read.</summary>
        public void AddByUt(string centre, Guid vessel, CraftKnowledgeState state, Func<double, double?> lastKnownAt, Func<double, double?> uncertaintyAt, Func<double, Sitrep.Contract.CraftPlace?>? place = null, double? extentM = null)
        {
            if (!_byCentre.TryGetValue(centre, out var list))
            {
                _byCentre[centre] = list = new List<Func<double, CraftKnowledgeSample>>();
            }
            list.Add(ut => new CraftKnowledgeSample(vessel.ToString(), state, null, lastKnownAt(ut), uncertaintyAt(ut), false, place?.Invoke(ut), extentM));
        }

        public void Clear()
        {
            _byCentre.Clear();
            Version++;
        }

        public int ReadCentre(string centreId, double ut, CraftKnowledgeSample[] buffer, out long version)
        {
            version = Version;
            AskedAt[centreId] = ut;
            if (!_byCentre.TryGetValue(centreId, out var list))
            {
                return 0;
            }
            for (var i = 0; i < list.Count && i < buffer.Length; i++)
            {
                buffer[i] = list[i](ut);
            }
            return list.Count;
        }

        public CraftKnowledgeReading KnowledgeAt(string centreId, string vesselId, double ut) =>
            throw new NotSupportedException();
    }
}
