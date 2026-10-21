using System;
using System.Collections.Generic;
using System.Linq;
using CommNet;
using Sitrep.Contract;
using Xunit;

namespace Gonogo.RealAntennasUplink.Tests.Routing
{
    /// <summary>
    /// <see cref="RaRouting"/> against the real CommNet types, with the network
    /// shaped the way RealAntennas shapes it: <c>FindClosestWhere</c> overridden
    /// (RA's only routing override) and <c>FindPath</c> left inherited from stock
    /// (which RA never touches).
    ///
    /// <para>What is under test is which router is entered. Reaching stock's is
    /// not a near miss, it is the whole defect: stock's walk has no notion of
    /// RA's minimum relay tech level, so it happily quotes a signal delay over a
    /// relay the game refuses to carry traffic through.</para>
    /// </summary>
    public class RaRoutingTests
    {
        /// <summary>A network with RA's routing shape and a counter on each router.</summary>
        private sealed class RaShapedNetwork : CommNetwork
        {
            private readonly Func<CommNode, CommNode, CommNode[]?> _raRoute;

            internal RaShapedNetwork(Func<CommNode, CommNode, CommNode[]?> raRoute) => _raRoute = raRoute;

            internal int StockSolves { get; private set; }

            internal int RaSolves { get; private set; }

            /// <summary>Lists the path's links last to first, as a solver that walks from the far end would.</summary>
            internal bool ListReversed { get; set; }

            /// <summary>Stores each link with its a and b swapped against the way the route runs.</summary>
            internal bool SwapEnds { get; set; }

            public override bool FindPath(CommNode start, CommPath path, CommNode end)
            {
                StockSolves++;
                return base.FindPath(start, path, end);
            }

            public override CommNode? FindClosestWhere(
                CommNode start,
                CommPath path,
                Func<CommNode, CommNode, bool> where)
            {
                RaSolves++;
                path?.Clear();
                var chain = _raRoute(start, start);
                if (chain == null || !where(start, chain[chain.Length - 1]))
                {
                    return null;
                }
                var links = new List<CommLink>();
                for (var i = 0; i + 1 < chain.Length; i++)
                {
                    links.Add(SwapEnds
                        ? new CommLink { a = chain[i + 1], b = chain[i] }
                        : new CommLink { a = chain[i], b = chain[i + 1] });
                }
                if (ListReversed)
                {
                    links.Reverse();
                }
                foreach (var link in links)
                {
                    path?.Add(link);
                }
                return chain[chain.Length - 1];
            }
        }

        private static CommNode NodeAt(CommNetwork net, double x, double y = 0.0, bool isHome = false)
        {
            var node = new CommNode
            {
                precisePosition = new Vector3d(x, y, 0.0),
                isHome = isHome,
            };
            node.SetNet(net);
            return node;
        }

        [Fact]
        public void RoutesThroughRealAntennasOwnRouter_NeverStocks()
        {
            CommNode? origin = null;
            CommNode? relay = null;
            CommNode? target = null;
            var net = new RaShapedNetwork((_, __) => new[] { origin!, relay!, target! });
            origin = NodeAt(net, 0.0);
            relay = NodeAt(net, 300.0, 400.0);
            target = NodeAt(net, 1000.0, isHome: true);

            var hops = RaRouting.Between(origin, target);

            Assert.NotNull(hops);
            Assert.Equal(2, hops!.Count);
            Assert.Equal(500.0, hops[0].DistanceMeters, 6);
            Assert.False(hops[0].TouchesHome);
            Assert.True(hops[1].TouchesHome);
            Assert.Equal(1, net.RaSolves);
            Assert.Equal(0, net.StockSolves);
        }

        [Fact]
        public void ARefusedRoute_IsNull_NeverZero()
        {
            var net = new RaShapedNetwork((_, __) => null);
            var origin = NodeAt(net, 0.0);
            var target = NodeAt(net, 1000.0);

            Assert.Null(RaRouting.Between(origin, target));
            Assert.Equal(0, net.StockSolves);
        }

        [Fact]
        public void AnEndTheRouterReachesButTheCallerDidNotAskFor_IsNotARoute()
        {
            CommNode? origin = null;
            CommNode? somewhereElse = null;
            var net = new RaShapedNetwork((_, __) => new[] { origin!, somewhereElse! });
            origin = NodeAt(net, 0.0);
            somewhereElse = NodeAt(net, 1000.0);
            var target = NodeAt(net, 2000.0);

            Assert.Null(RaRouting.Between(origin, target));
        }

        [Fact]
        public void MissingOrIdenticalNodes_AreNull_AndNeverSolve()
        {
            var net = new RaShapedNetwork((_, __) => throw new InvalidOperationException("must not solve"));
            var node = NodeAt(net, 0.0);

            Assert.Null(RaRouting.Between(null, node));
            Assert.Null(RaRouting.Between(node, null));
            Assert.Null(RaRouting.Between(node, node));
            Assert.Equal(0, net.RaSolves);
            Assert.Equal(0, net.StockSolves);
        }

        [Fact]
        public void AHandleThatIsNotACommNode_IsNull()
        {
            var net = new RaShapedNetwork((_, __) => throw new InvalidOperationException("must not solve"));
            var node = NodeAt(net, 0.0);

            Assert.Null(RaRouting.Between(Sitrep.Contract.CommsNodeHandle.Of("not-a-node")!.As<CommNode>(), node));
            Assert.Null(RaRouting.Between(node, Sitrep.Contract.CommsNodeHandle.Of(42)!.As<CommNode>()));
        }

        /// <summary>The directions every hop carries, which is what a route carries.</summary>
        private static CommsDirection RouteCarries(IReadOnlyList<CommsRouteHop> hops) =>
            hops.Aggregate(CommsDirection.Both, (carried, hop) => carried & hop.Carries);

        private static (RaShapedNetwork Net, CommNode Origin, CommNode Relay, CommNode Target) Chain(
            bool listReversed = false,
            bool swapEnds = false)
        {
            CommNode? origin = null;
            CommNode? relay = null;
            CommNode? target = null;
            var net = new RaShapedNetwork((_, __) => new[] { origin!, relay!, target! })
            {
                ListReversed = listReversed,
                SwapEnds = swapEnds,
            };
            origin = NodeAt(net, 0.0);
            relay = NodeAt(net, 300.0, 400.0);
            target = NodeAt(net, 1000.0, isHome: true);
            return (net, origin, relay, target);
        }

        /// <summary>Rates keyed by the link's stored a node, so a test names a link by what it joins.</summary>
        private static Func<CommLink, (double?, double?)> Rates(
            Dictionary<CommNode, (double?, double?)> byA) => link => byA[link.a];

        [Fact]
        public void AHopWithNoForwardRate_CarriesReverse_AndSoDoesTheRoute()
        {
            var (_, origin, relay, target) = Chain();

            var hops = RaRouting.Between(origin, target, Rates(new()
            {
                [origin] = (0.0, 5.0),
                [relay] = (7.0, 7.0),
            }));

            Assert.Equal(CommsDirection.Reverse, hops![0].Carries);
            Assert.Equal(CommsDirection.Both, hops[1].Carries);
            Assert.Equal(CommsDirection.Reverse, RouteCarries(hops));
        }

        [Fact]
        public void TheSameLinkWalkedFromTheOtherEnd_SwapsWhichDirectionIsCarried()
        {
            var (_, origin, relay, target) = Chain(swapEnds: true);

            // Each link's a is the node nearer the target, so its forward rate runs back toward the origin
            var hops = RaRouting.Between(origin, target, Rates(new()
            {
                [relay] = (0.0, 5.0),
                [target] = (7.0, 7.0),
            }));

            Assert.Equal(CommsDirection.Forward, hops![0].Carries);
            Assert.Equal(CommsDirection.Both, hops[1].Carries);
            Assert.Equal(CommsDirection.Forward, RouteCarries(hops));
        }

        [Fact]
        public void ARateThatCannotBeRead_CountsAsCarried()
        {
            var (_, origin, relay, target) = Chain();

            var hops = RaRouting.Between(origin, target, Rates(new()
            {
                [origin] = (null, null),
                [relay] = (null, 0.0),
            }));

            Assert.Equal(CommsDirection.Both, hops![0].Carries);
            Assert.Equal(CommsDirection.Forward, hops[1].Carries);
        }

        [Fact]
        public void NoRateReader_MeansEveryHopCarriesBoth()
        {
            var (_, origin, _, target) = Chain();

            var hops = RaRouting.Between(origin, target);

            Assert.All(hops!, hop => Assert.Equal(CommsDirection.Both, hop.Carries));
        }

        [Theory]
        [InlineData(false, false)]
        [InlineData(true, false)]
        [InlineData(false, true)]
        [InlineData(true, true)]
        public void OrientationHolds_WhicheverOrderThePathListsItsLinksAndWhicheverEndIsStoredAsA(
            bool listReversed,
            bool swapEnds)
        {
            var (_, origin, relay, target) = Chain(listReversed, swapEnds);
            var stored = swapEnds ? (first: relay, second: target) : (first: origin, second: relay);
            // The origin-relay link is blocked origin to relay; the relay-target link is blocked target to relay
            var rates = new Dictionary<CommNode, (double?, double?)>
            {
                [stored.first] = swapEnds ? (5.0, 0.0) : (0.0, 5.0),
                [stored.second] = swapEnds ? (0.0, 5.0) : (5.0, 0.0),
            };

            var hops = RaRouting.Between(origin, target, Rates(rates));

            Assert.Equal(2, hops!.Count);
            Assert.Equal(CommsDirection.Reverse, hops[0].Carries);
            Assert.Equal(CommsDirection.Forward, hops[1].Carries);
            Assert.Equal(CommsDirection.None, RouteCarries(hops));
            Assert.Same(origin, hops[0].FromHandle!.As<CommNode>());
            Assert.Same(relay, hops[0].ToHandle!.As<CommNode>());
            Assert.Same(relay, hops[1].FromHandle!.As<CommNode>());
            Assert.Same(target, hops[1].ToHandle!.As<CommNode>());
        }
    }
}
