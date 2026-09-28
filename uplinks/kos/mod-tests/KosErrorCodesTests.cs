using System;
using Gonogo.KosUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// This Uplink's refinements are all under its own id and refine a core
    /// root, which is what the host checks before it lets any of them onto the
    /// wire: one that is not drops the Uplink's whole set.
    /// </summary>
    public class KosErrorCodesTests
    {
        [Fact]
        public void EveryCodeIsARefinementUnderThisUplinksId()
        {
            var codes = ErrorCodeCatalog.Of(typeof(KosErrorCodes));

            Assert.Equal(3, codes.Count);
            Assert.All(codes, code =>
            {
                Assert.False(code.IsRoot, code.Id);
                Assert.Equal("kos", code.Owner);
                Assert.Contains(code.Root, CommandErrorCode.Roots);
                Assert.False(string.IsNullOrWhiteSpace(code.Sentence), code.Id);
            });
        }
    }
}
