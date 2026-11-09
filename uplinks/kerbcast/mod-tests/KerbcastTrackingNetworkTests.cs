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
/// A tracking network under the delay lock: every vantage's site bound from the
/// network's status, which networks gonogo aims, and when an uncrewed relay among
/// its vantages may show a craft.
/// </summary>
public class KerbcastTrackingNetworkTests
{
    private const string Ksc = "ground:KSC";
    private const double Light = 299792458.0;
    private const double SlowLight = 1000.0;
    private const uint Network = 7;
    private const uint SavedNetwork = 0xFFFF0003;
    private static readonly Guid ProbeId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid RelayId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private const uint ProbePid = 101;
    private const uint RelayPid = 202;
    private const uint OtherPid = 303;
    private static readonly string RelayScope = "vessel:" + RelayId;

    private readonly RecordingKerbcast _kc = new RecordingKerbcast();
    private readonly FakeSites _sites = new FakeSites();
    private readonly FakeBoard _board = new FakeBoard();
    private readonly CraftLabels _labels = new CraftLabels();
    private readonly CraftPlaces _places = new CraftPlaces();
    private readonly KerbcastAuthority _authority;
    private uint? _active = ProbePid;
    private readonly KerbcastWorldModel _model;

    public KerbcastTrackingNetworkTests()
    {
        _authority = new KerbcastAuthority(() => _kc, _kc.Supports);
        _model = new KerbcastWorldModel(_labels, _kc.Supports, _places, activeCraft: () => _active, supportsNetworks: () => true);
        _kc.Cameras.Learn(ProbePid, ProbeId);
        _kc.Cameras.Learn(RelayPid, RelayId);
        _kc.Cameras.Learn(OtherPid, OtherId);
        _sites.Stations["KSC"] = Ksc;
        _sites.Delivered[Ksc] = 100.0;
    }

    private void AddNetwork(uint subject = 0, uint flightId = Network)
    {
        _kc.Command.AddFeed(new CommandFeed { FlightId = flightId, SiteKey = "KSC", SiteKind = SiteKind.Station, Network = true, SubjectPersistentId = subject });
        _kc.Command.SetNetworkStatus(flightId, new[]
        {
            new NetworkVantageStatus { SiteKey = "KSC", SiteKind = SiteKind.Station, Active = true, State = "ok" },
            new NetworkVantageStatus { SiteKey = "Comms Relay", SiteKind = SiteKind.Vessel, VantagePersistentId = RelayPid, State = "unknown" },
        });
        if (subject != 0)
        {
            _authority.Tick(0.0, Light);
            _kc.Command.SetAim(flightId, Aim.Vessel(subject), KerbcastAuthority.Owner);
        }
    }

    private PublishResult? Publish(double ut, double real, double lightSpeed = Light, int? tenure = null)
    {
        _authority.Tick(real, Light);
        return _model.Publish(_kc, _authority.Publisher!, tenure ?? _authority.Tenure, _sites, _board, ut, real, lightSpeed);
    }

    private void Heard(uint pid = ProbePid) => _board.Add(Ksc, pid == ProbePid ? ProbeId : OtherId, CraftKnowledgeState.Heard, 99.0);

    private int Aims() => _kc.Calls.Count(c => c.StartsWith("SetAim " + Network, StringComparison.Ordinal));

    private void Places(Guid craft, double from, double to)
    {
        for (var ut = from; ut <= to; ut += 1.0)
        {
            _places.Learn(craft, CraftPlace.State(ut, 1, 1000.0 + ut, 0.0, 700000.0, 1.0, 0.0, 0.0));
        }
    }

    private void Sight(bool known = true, bool visible = true, double rangeM = 2000.0, bool disabled = false) =>
        _kc.Command.SetLineOfSight(new LineOfSightResult(known, visible, null, false, rangeM, disabled));

    /* A network with a relay among its vantages, the relay's frontier at home's delay, the probe recorded at every instant, and the relay's view of it clear. */
    private void RelayNetwork()
    {
        AddNetwork(ProbePid);
        _sites.Delivered[RelayScope] = 95.0;
        Places(ProbeId, 80.0, 100.0);
        Sight();
    }

    private PublishedRecord? RelayRecord() => _kc.Command.Published.Last().Find(RelayScope, ProbePid);

    [Fact]
    public void EveryVantageIsBoundNotOnlyTheOneOnAir()
    {
        AddNetwork();

        Publish(100.0, 0.0);

        var bindings = _kc.Command.Published.Last().SiteBindings;
        Assert.Equal(Ksc, bindings["KSC"]);
        Assert.Equal(RelayScope, bindings["Comms Relay"]);
    }

    [Fact]
    public void AnUncrewedRelayIsCommandedByHomeAndACrewedCraftByItself()
    {
        AddNetwork();
        Publish(100.0, 0.0);
        Assert.Contains((RelayScope, RelayScope, Ksc), _sites.Bound);

        _board.Add(RelayScope, ProbeId, CraftKnowledgeState.Heard, 99.0);
        Publish(101.0, 1.0);
        Assert.Contains((RelayScope, RelayScope, RelayScope), _sites.Bound);
    }

    [Fact]
    public void ANetworkThatFollowsTheActiveCraftIsAimedAtItOnce()
    {
        AddNetwork();
        Heard();

        Publish(100.0, 0.0);
        Publish(101.0, 1.0);

        Assert.Equal(1, Aims());
        Assert.Contains($"SetAim {Network} Vessel({ProbePid}) gonogo", _kc.Calls);
    }

    [Fact]
    public void AFollowingNetworkKeepsFollowingAfterItsAimClearedTheFlag()
    {
        AddNetwork();
        Heard();
        Publish(100.0, 0.0);
        Assert.False(_kc.Command.Feeds().Single(f => f.FlightId == Network).FollowsActiveVessel);

        _active = OtherPid;
        Heard(OtherPid);
        Publish(101.0, 1.0);

        Assert.Contains($"SetAim {Network} Vessel({OtherPid}) gonogo", _kc.Calls);
    }

    [Fact]
    public void ANetworkWatchingAChosenCraftIsNeverAimed()
    {
        AddNetwork(OtherPid);
        Heard();
        _kc.ClearCalls();

        Publish(100.0, 0.0);
        Publish(101.0, 1.0);

        Assert.Equal(0, Aims());
    }

    [Fact]
    public void AViewerAimStopsANetworkFollowing()
    {
        AddNetwork();
        Heard();
        Publish(100.0, 0.0);
        _model.SayViewerAim(Network);
        _kc.ClearCalls();

        _active = OtherPid;
        Heard(OtherPid);
        Publish(101.0, 1.0);

        Assert.Equal(0, Aims());
    }

    [Fact]
    public void AViewerAimAtAGroundFeedIsNotOverwrittenByTheFollow()
    {
        const uint ground = 9;
        _kc.Command.AddFeed(new CommandFeed { FlightId = ground, SiteKey = "KSC", SiteKind = SiteKind.Station });
        _kc.Command.SetTargets(ground, new[] { new CommandTarget { PersistentId = ProbePid, Eligibility = "ok" } });
        Heard();
        Publish(100.0, 0.0);
        Assert.Contains($"SetAim {ground} Vessel({ProbePid}) gonogo", _kc.Calls);

        _kc.Command.SetAim(ground, Aim.Vessel(OtherPid), KerbcastAuthority.Owner);
        _model.SayViewerAim(ground);
        _kc.ClearCalls();
        Publish(100.1, 0.1);

        Assert.DoesNotContain(_kc.Calls, c => c.StartsWith("SetAim " + ground, StringComparison.Ordinal));
    }

    [Fact]
    public void AFollowRefusedBeforeThePublishThatNamesTheCraftIsSentAgainAfterIt()
    {
        AddNetwork();
        Heard();
        var published = false;
        _kc.Command.AimJudge = (_, _) => published ? AimResult.Ok : AimResult.UnknownCraft;

        Publish(100.0, 0.0);
        Assert.Equal(1, Aims());
        Assert.False(_model.Following);

        published = true;
        Publish(100.1, 0.1);
        Publish(100.2, 0.2);

        Assert.Equal(2, Aims());
        Assert.True(_model.Following);
    }

    [Fact]
    public void ARefusedFollowWaitsForEachPublishBeforeItIsSentAgain()
    {
        AddNetwork();
        Heard();
        _kc.Command.AimJudge = (_, _) => AimResult.UnknownCraft;

        Publish(100.0, 0.0);
        Publish(100.1, 0.1);
        Publish(100.2, 0.2);
        Assert.Equal(2, Aims());

        Publish(102.0, KerbcastWorldModel.RefreshSeconds + 0.1);
        Publish(102.1, KerbcastWorldModel.RefreshSeconds + 0.2);

        Assert.Equal(3, Aims());
    }

    [Fact]
    public void AFollowRefusedForOneCraftDoesNotHoldBackTheNextActiveCraft()
    {
        AddNetwork();
        Heard();
        Heard(OtherPid);
        _kc.Command.AimJudge = (_, aim) => aim.SubjectPersistentId == ProbePid ? AimResult.UnknownCraft : AimResult.Ok;
        Publish(100.0, 0.0);
        Publish(100.1, 0.1);
        Assert.Equal(2, Aims());

        _active = OtherPid;
        Publish(100.2, 0.2);

        Assert.Contains($"SetAim {Network} Vessel({OtherPid}) gonogo", _kc.Calls);
    }

    [Fact]
    public void WhetherANetworkFollowsIsReadAgainInANewLockTenure()
    {
        AddNetwork();
        Heard();
        Publish(100.0, 0.0);
        _kc.ClearCalls();

        // The aim made in the old tenure reads as a chosen watch in the new one.
        _active = OtherPid;
        Heard(OtherPid);
        Publish(101.0, 1.0, tenure: _authority.Tenure + 1);

        Assert.Equal(0, Aims());
    }

    [Fact]
    public void ASavedNetworkFollowsTheActiveCraftLikeAMadeOne()
    {
        AddNetwork(flightId: SavedNetwork);
        Heard();

        Publish(100.0, 0.0);
        Publish(101.0, 1.0);

        Assert.Equal(1, _kc.Calls.Count(c => c.StartsWith("SetAim " + SavedNetwork, StringComparison.Ordinal)));
        Assert.Contains($"SetAim {SavedNetwork} Vessel({ProbePid}) gonogo", _kc.Calls);
        var bindings = _kc.Command.Published.Last().SiteBindings;
        Assert.Equal(RelayScope, bindings["Comms Relay"]);
    }

    [Fact]
    public void ASavedNetworkWatchingAChosenCraftIsNeverAimedAndItsRelaySeesThatCraft()
    {
        AddNetwork(ProbePid, SavedNetwork);
        _sites.Delivered[RelayScope] = 95.0;
        Places(ProbeId, 80.0, 100.0);
        Sight();
        Heard(OtherPid);
        _active = OtherPid;
        _kc.ClearCalls();

        Publish(100.0, 0.0, SlowLight);

        Assert.DoesNotContain(_kc.Calls, c => c.StartsWith("SetAim " + SavedNetwork, StringComparison.Ordinal));
        Assert.NotNull(RelayRecord());
    }

    [Fact]
    public void ARelayWithSightShowsTheCraftWhereItsLightLeftIt()
    {
        RelayNetwork();

        Publish(100.0, 0.0, SlowLight);

        var record = RelayRecord();
        Assert.NotNull(record);
        Assert.Equal(CraftFixState.Positioned, record!.State);
        Assert.Equal(93.0, record.ValidFromUt);
        Assert.Equal(1093.0, record.Position.X, 3);
    }

    [Fact]
    public void LineOfSightIsAskedAtTheRelaysObserveTime()
    {
        RelayNetwork();

        Publish(100.0, 0.0, SlowLight);

        var asks = _kc.Calls.Where(c => c.StartsWith("LineOfSight ", StringComparison.Ordinal)).ToList();
        Assert.NotEmpty(asks);
        Assert.All(asks, c => Assert.Contains($"Vessel({RelayPid}) 95 1 ", c));
    }

    [Fact]
    public void ARelayWithoutSightShowsNothing()
    {
        RelayNetwork();
        Sight(visible: false);

        Publish(100.0, 0.0, SlowLight);

        Assert.Null(RelayRecord());
    }

    [Fact]
    public void AnUnknownLineOfSightIsNeverSight()
    {
        RelayNetwork();
        Sight(known: false, rangeM: double.NaN);

        Publish(100.0, 0.0, SlowLight);

        Assert.Null(RelayRecord());
    }

    [Fact]
    public void ACraftWithNoHeardSizePastTheSightRangeOfADefaultCraftIsNotSeen()
    {
        RelayNetwork();
        Sight(rangeM: KerbcastWorldModel.RelaySightRangeM(4.0) + 1.0);

        Publish(100.0, 0.0, Light);

        Assert.Null(RelayRecord());
    }

    [Fact]
    public void ALargeCraftIsSeenFartherOffThanASmallOne()
    {
        RelayNetwork();
        _board.AddSized(Ksc, ProbeId, 15.0);
        Sight(rangeM: KerbcastWorldModel.RelaySightRangeM(4.0) + 1.0);

        Publish(100.0, 0.0, Light);

        Assert.NotNull(RelayRecord());
    }

    [Fact]
    public void TheSightRangeComesFromTheResolutionKerbcastReports()
    {
        RelayNetwork();
        var resolution = 4.848e-6;
        _kc.Command.SetLineOfSight(new LineOfSightResult(true, true, null, false, KerbcastWorldModel.RelaySightRangeM(4.0, resolution) + 1.0, false, resolution));

        Publish(100.0, 0.0, Light);

        Assert.Null(RelayRecord());
    }

    [Fact]
    public void WithoutTheResolutionFeatureTheSightRangeFallsBackToTheShippedLens()
    {
        _kc.SetSupported(f => f != ApiFeature.VantageResolution);
        RelayNetwork();
        _kc.Command.SetLineOfSight(new LineOfSightResult(true, true, null, false, 2000.0, false, 4.848e-6));

        Publish(100.0, 0.0, Light);

        Assert.NotNull(RelayRecord());
    }

    [Theory]
    [InlineData(2.0, 1_650_138.0)]
    [InlineData(4.0, 3_300_276.0)]
    [InlineData(30.0, 24_752_076.0)]
    public void TheSightRangeAtTheShippedLensIsWhatOnePixelResolves(double craftAcrossM, double expectedM)
    {
        Assert.InRange(KerbcastWorldModel.RelaySightRangeM(craftAcrossM), expectedM - 1000.0, expectedM + 1000.0);
    }

    [Fact]
    public void ARelayWhosePathHomeIsLostShowsNothing()
    {
        RelayNetwork();
        Publish(100.0, 0.0, SlowLight);
        Assert.NotNull(RelayRecord());

        // The frontier holds still while no path reaches the relay.
        Publish(103.0, 3.0, SlowLight);

        Assert.Null(RelayRecord());
    }

    [Fact]
    public void ARelayThatHasNeverHeardHomeShowsNothing()
    {
        AddNetwork(ProbePid);
        Places(ProbeId, 80.0, 100.0);
        Sight();

        Publish(100.0, 0.0, SlowLight);

        Assert.Null(_kc.Command.Published.Last().Find(RelayScope, ProbePid));
    }

    [Fact]
    public void ARelayWithNoRecordOfTheCraftUsesWhatHomeHasToldIt()
    {
        AddNetwork(ProbePid);
        _sites.Delivered[RelayScope] = 95.0;
        Sight();
        _board.AddWithPlace(Ksc, ProbeId, CraftKnowledgeState.Modelled, 90.0, 50.0, ut => new Sitrep.Contract.CraftPlace(1, new Vector3d(1000.0 + ut, 0.0, 700000.0), Sitrep.Contract.CraftPlaceBasis.Coasting));

        Publish(100.0, 0.0, SlowLight);

        var record = RelayRecord();
        Assert.NotNull(record);
        Assert.Equal(CraftFixState.Positioned, record!.State);
        Assert.Equal(1095.0, record.Position.X, 3);
    }

    [Fact]
    public void WhatTheRelaysAndNetworksCostPerPublishIsBounded()
    {
        const int relays = 8;
        var statuses = new List<NetworkVantageStatus> { new NetworkVantageStatus { SiteKey = "KSC", SiteKind = SiteKind.Station, Active = true, State = "ok" } };
        for (var i = 0; i < relays; i++)
        {
            var pid = 1000u + (uint)i;
            var id = Guid.NewGuid();
            _kc.Cameras.Learn(pid, id);
            statuses.Add(new NetworkVantageStatus { SiteKey = "Relay" + i, SiteKind = SiteKind.Vessel, VantagePersistentId = pid, State = "unknown" });
            _sites.Delivered["vessel:" + id] = 95.0;
        }
        _kc.Command.AddFeed(new CommandFeed { FlightId = Network, SiteKey = "KSC", SiteKind = SiteKind.Station, Network = true, SubjectPersistentId = ProbePid });
        _kc.Command.SetNetworkStatus(Network, statuses);
        _authority.Tick(0.0, Light);
        _kc.Command.SetAim(Network, Aim.Vessel(ProbePid), KerbcastAuthority.Owner);
        _board.Add(Ksc, ProbeId, CraftKnowledgeState.Heard, 99.0);
        Places(ProbeId, 80.0, 100.0);
        Sight();
        Publish(100.0, 0.0, SlowLight);
        _kc.ClearCalls();
        _board.Reads = 0;

        Publish(100.0, 0.1, SlowLight);

        // One board read per relay to know it is a relay, and home's own read; a relay's sight needs no read of the board.
        Assert.Equal(relays + 1, _board.Reads);
        // A line of sight tested in the last half second is reused.
        Assert.DoesNotContain(_kc.Calls, c => c.StartsWith("LineOfSight ", StringComparison.Ordinal));
    }

    private sealed class FakeSites : ILensSites
    {
        public readonly Dictionary<string, string> Stations = new();
        public readonly Dictionary<string, double> Delivered = new();
        public readonly List<(string Scope, string Site, string Centre)> Bound = new();

        public string ProviderId => "fake-sites";

        public string? GroundStationNamed(string nodeName) => Stations.TryGetValue(nodeName, out var id) ? id : null;

        public string? GroundStationNear(int bodyIndex, double latitude, double longitude) => null;

        public void Bind(string scope, string site, string commandingCentre) => Bound.Add((scope, site, commandingCentre));

        public void Unbind(string scope, string site)
        {
        }

        public double? KnowledgeUt(string scope) => Delivered.TryGetValue(scope, out var ut) ? ut : null;
    }

    private sealed class FakeBoard : IBulkCraftKnowledge
    {
        private readonly Dictionary<string, List<Func<double, CraftKnowledgeSample>>> _byCentre = new();

        public int Reads { get; set; }

        public string ProviderId => "fake-board";

        public long Version { get; set; } = 1;

        public void Add(string centre, Guid vessel, CraftKnowledgeState state, double? lastKnownUt) =>
            AddWithPlace(centre, vessel, state, lastKnownUt, null, null);

        public void AddWithPlace(string centre, Guid vessel, CraftKnowledgeState state, double? lastKnownUt, double? uncertaintyM, Func<double, Sitrep.Contract.CraftPlace?>? place)
        {
            if (!_byCentre.TryGetValue(centre, out var list))
            {
                _byCentre[centre] = list = new List<Func<double, CraftKnowledgeSample>>();
            }
            list.Add(ut => new CraftKnowledgeSample(vessel.ToString(), state, null, lastKnownUt, uncertaintyM, false, place?.Invoke(ut)));
        }

        public void AddSized(string centre, Guid vessel, double extentM)
        {
            if (!_byCentre.TryGetValue(centre, out var list))
            {
                _byCentre[centre] = list = new List<Func<double, CraftKnowledgeSample>>();
            }
            list.Add(_ => new CraftKnowledgeSample(vessel.ToString(), CraftKnowledgeState.Heard, null, 99.0, null, false, null, extentM));
        }

        public int ReadCentre(string centreId, double ut, CraftKnowledgeSample[] buffer, out long version)
        {
            version = Version;
            Reads++;
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

        public CraftKnowledgeReading KnowledgeAt(string centreId, string vesselId, double ut) => CraftKnowledgeReading.Unknown;
    }
}
