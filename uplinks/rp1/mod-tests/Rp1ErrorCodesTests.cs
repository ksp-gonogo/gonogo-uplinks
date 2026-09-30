using System;
using GonogoRp1Uplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    /// <summary>
    /// This Uplink's refinements are all under its own id and refine a core
    /// root, which is what the host checks before it lets any of them onto the
    /// wire: one that is not drops the Uplink's whole set.
    /// </summary>
    public class Rp1ErrorCodesTests
    {
        [Fact]
        public void EveryCodeIsARefinementUnderThisUplinksId()
        {
            var codes = ErrorCodeCatalog.Of(typeof(Rp1ErrorCodes));

            Assert.Equal(4, codes.Count);
            Assert.All(codes, code =>
            {
                Assert.False(code.IsRoot, code.Id);
                Assert.Equal("rp1", code.Owner);
                Assert.Contains(code.Root, CommandErrorCode.Roots);
                Assert.False(string.IsNullOrWhiteSpace(code.Sentence), code.Id);
            });
        }
    }
}
