using System;
using System.Collections.Generic;
using System.Linq;
using Gonogo.KerbcastUplink;
using Kerbcast.Api;
using Kerbcast.Api.Testing;
using Sitrep.Contract;
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

        public void Bind(string scope, string site, string commandingCentre) => Bound.Add((scope, site, commandingCentre));

        public void Unbind(string scope, string site) => Unbound.Add((scope, site));

        public double? KnowledgeUt(string scope) => Delivered.TryGetValue(scope, out var ut) ? ut : null;
    }

    private sealed class FakeKnowledge : IBulkCraftKnowledge
    {
        private readonly Dictionary<string, List<CraftKnowledgeSample>> _byCentre = new();
        public readonly Dictionary<string, double> AskedAt = new();

        public string ProviderId => "fake-knowledge";

        public long Version { get; set; } = 1;

        public void Add(string centre, Guid vessel, CraftKnowledgeState state, double? lastKnownUt, double? uncertaintyM = null)
        {
            if (!_byCentre.TryGetValue(centre, out var list))
            {
                _byCentre[centre] = list = new List<CraftKnowledgeSample>();
            }
            list.Add(new CraftKnowledgeSample(vessel.ToString(), state, null, lastKnownUt, uncertaintyM, false));
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
                buffer[i] = list[i];
            }
            return list.Count;
        }

        public CraftKnowledgeReading KnowledgeAt(string centreId, string vesselId, double ut) =>
            throw new NotSupportedException();
    }
}
