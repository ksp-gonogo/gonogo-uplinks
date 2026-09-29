using GonogoPrincipiaUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// This Uplink's refinements are all under its own id and refine a core
    /// root, which is what the host checks before it lets any of them onto the
    /// wire: one that is not drops the Uplink's whole set.
    /// </summary>
    public class PrincipiaErrorCodesTests
    {
        [Fact]
        public void EveryCodeIsARefinementUnderThisUplinksId()
        {
            var codes = ErrorCodeCatalog.Of(typeof(PrincipiaErrorCodes));

            Assert.Equal(21, codes.Count);
            Assert.All(codes, code =>
            {
                Assert.False(code.IsRoot, code.Id);
                Assert.Equal("principia", code.Owner);
                Assert.Contains(code.Root, CommandErrorCode.Roots);
                Assert.False(string.IsNullOrWhiteSpace(code.Sentence), code.Id);
            });
        }
    }
}
