using System;
using GonogoKerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// This Uplink's refinements are all under its own id and refine a core
    /// root, which is what the host checks before it lets any of them onto the
    /// wire: one that is not drops the Uplink's whole set.
    /// </summary>
    public class KerbalismErrorCodesTests
    {
        [Fact]
        public void EveryCodeIsARefinementUnderThisUplinksId()
        {
            var codes = ErrorCodeCatalog.Of(typeof(KerbalismErrorCodes));

            Assert.Equal(4, codes.Count);
            Assert.All(codes, code =>
            {
                Assert.False(code.IsRoot, code.Id);
                Assert.Equal("kerbalism", code.Owner);
                Assert.Contains(code.Root, CommandErrorCode.Roots);
                Assert.False(string.IsNullOrWhiteSpace(code.Sentence), code.Id);
            });
        }
    }
}
