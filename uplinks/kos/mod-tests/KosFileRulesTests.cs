using System.Linq;
using System.Text;
using Gonogo.KosUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// The path, text and compare-and-set rules every <c>kos.files.*</c> command
    /// applies before kOS sees the request.
    /// </summary>
    public class KosFileRulesTests
    {
        [Theory]
        [InlineData("launch.ks")]
        [InlineData("lib/orbit_2.ks")]
        [InlineData("notes/ascent-plan.txt")]
        [InlineData("data/config.json")]
        [InlineData("UPPER.KS")]
        [InlineData("a/b/c/d/e/f/g/h.ks")]
        public void AnOrdinaryPathInsideTheVolume_IsAccepted(string path)
        {
            Assert.Null(KosFileRules.PathRefusal(path));
        }

        [Theory]
        [InlineData(null, "the path is empty")]
        [InlineData("", "the path is empty")]
        [InlineData("../escape.ks", "the path may not use . or ..")]
        [InlineData("lib/../../escape.ks", "the path may not use . or ..")]
        [InlineData("./here.ks", "the path may not use . or ..")]
        [InlineData("/abs.ks", "the path must be relative to the volume's root, with no volume or leading /")]
        [InlineData("0:/abs.ks", "the path must be relative to the volume's root, with no volume or leading /")]
        [InlineData("C:\\boot.ks", "the path must be relative to the volume's root, with no volume or leading /")]
        [InlineData("lib\\boot.ks", "a name may use only letters, digits, _, - and .")]
        [InlineData("my script.ks", "a name may use only letters, digits, _, - and .")]
        [InlineData("caf\u00e9.ks", "a name may use only letters, digits, _, - and .")]
        [InlineData("semi;colon.ks", "a name may use only letters, digits, _, - and .")]
        [InlineData("nul\0.ks", "a name may use only letters, digits, _, - and .")]
        [InlineData("lib//boot.ks", "the path has an empty segment")]
        [InlineData("lib/", "the path has an empty segment")]
        [InlineData(".hidden.ks", "a name may not start with .")]
        [InlineData("a/b/c/d/e/f/g/h/i.ks", "the path is more than 8 folders deep")]
        public void APathOutsideTheRules_IsRefusedAsABadPath(string? path, string detail)
        {
            var refusal = KosFileRules.PathRefusal(path);

            Assert.NotNull(refusal);
            Assert.Equal(KosErrorCodes.BadPath, refusal!.ErrorCode);
            Assert.Equal(detail, refusal.Detail);
        }

        [Fact]
        public void APathLongerThanTheCap_IsRefusedAsABadPath()
        {
            var refusal = KosFileRules.PathRefusal(new string('a', KosFileRules.MaxPathLength) + ".ks");

            Assert.Equal(KosErrorCodes.BadPath, refusal!.ErrorCode);
            Assert.Equal("the path is longer than 200 characters", refusal.Detail);
        }

        [Theory]
        [InlineData("boot")]
        [InlineData("boot.exe")]
        [InlineData("boot.ks.bak")]
        [InlineData("lib/boot.cfg")]
        public void AnExtensionOutsideTheFour_IsRefused(string path)
        {
            var refusal = KosFileRules.PathRefusal(path);

            Assert.Equal(KosErrorCodes.FileType, refusal!.ErrorCode);
            Assert.Equal("the file must end in .ks, .ksm, .txt or .json", refusal.Detail);
        }

        [Theory]
        [InlineData("boot.ksm")]
        [InlineData("lib/BOOT.KSM")]
        public void ACompiledKsm_IsRefusedAsBinary(string path)
        {
            var refusal = KosFileRules.PathRefusal(path);

            Assert.Equal(KosErrorCodes.NotText, refusal!.ErrorCode);
            Assert.Equal("a compiled .ksm file is binary and cannot be read or written as text", refusal.Detail);
        }

        [Theory]
        [InlineData("0:")]
        [InlineData("1:")]
        public void TheArchiveAndTheCpuDrive_AreTheVolumes(string volume)
        {
            Assert.Null(KosFileRules.VolumeRefusal(volume));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("2:")]
        [InlineData("Archive")]
        [InlineData("0:/")]
        public void AnyOtherVolume_IsRefused(string? volume)
        {
            var refusal = KosFileRules.VolumeRefusal(volume);

            Assert.Equal(CommandErrorCode.NotFound, refusal!.ErrorCode);
            Assert.Equal("the volume must be 0: (the Archive) or 1: (the CPU's own drive)", refusal.Detail);
        }

        [Fact]
        public void ARenameOntoItsOwnPath_IsRefused()
        {
            var refusal = KosFileRules.RenameRefusal("lib/a.ks", "LIB/A.ks");

            Assert.Equal(KosErrorCodes.BadPath, refusal!.ErrorCode);
            Assert.Equal("the new path is the same file as the old one", refusal.Detail);
        }

        [Fact]
        public void ARenameTarget_IsHeldToThePathRules()
        {
            Assert.Equal(KosErrorCodes.BadPath, KosFileRules.RenameRefusal("a.ks", "../a.ks")!.ErrorCode);
            Assert.Equal(KosErrorCodes.FileType, KosFileRules.RenameRefusal("a.ks", "a.exe")!.ErrorCode);
            Assert.Null(KosFileRules.RenameRefusal("a.ks", "lib/b.ks"));
        }

        [Fact]
        public void TextOf_ReadsUtf8()
        {
            Assert.Null(KosFileRules.TextOf(Encoding.UTF8.GetBytes("print \"caf\u00e9\".\n"), out var text));
            Assert.Equal("print \"caf\u00e9\".\n", text);
        }

        [Fact]
        public void TextOf_RefusesBytesThatAreNotUtf8()
        {
            var refusal = KosFileRules.TextOf(new byte[] { 0x1f, 0x8b, 0x08, 0x00, 0xff }, out _);

            Assert.Equal(KosErrorCodes.NotText, refusal!.ErrorCode);
            Assert.Equal("the file is not UTF-8 text", refusal.Detail);
        }

        [Fact]
        public void TextOf_RefusesANul()
        {
            Assert.Equal(KosErrorCodes.NotText, KosFileRules.TextOf(new byte[] { 0x61, 0x00, 0x62 }, out _)!.ErrorCode);
        }

        [Fact]
        public void TextOf_RefusesAFileOverTheCap()
        {
            var refusal = KosFileRules.TextOf(new byte[KosFileRules.MaxFileBytes + 1], out _);

            Assert.Equal(KosErrorCodes.FileTooLarge, refusal!.ErrorCode);
            Assert.Equal("the file is 131073 bytes and the most a file command carries is 131072", refusal.Detail);
        }

        [Fact]
        public void BytesOf_SavesCrLfAsLf()
        {
            Assert.Null(KosFileRules.BytesOf("a\r\nb\n", out var bytes));
            Assert.Equal("a\nb\n", Encoding.UTF8.GetString(bytes));
        }

        [Fact]
        public void BytesOf_TakesTextExactlyAtTheCap()
        {
            Assert.Null(KosFileRules.BytesOf(new string('a', KosFileRules.MaxFileBytes), out _));
        }

        [Fact]
        public void BytesOf_RefusesTextOverTheCap()
        {
            var refusal = KosFileRules.BytesOf(new string('a', KosFileRules.MaxFileBytes + 1), out _);

            Assert.Equal(KosErrorCodes.FileTooLarge, refusal!.ErrorCode);
        }

        [Fact]
        public void BytesOf_RefusesANul()
        {
            Assert.Equal(KosErrorCodes.NotText, KosFileRules.BytesOf("a\0b", out _)!.ErrorCode);
        }

        [Fact]
        public void Hash_IsLowerHexSha256()
        {
            Assert.Equal(
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                KosFileRules.Hash(new byte[0]));
        }

        [Fact]
        public void CompareRefusal_ANewFileWhereNoneIs_GoesAhead()
        {
            Assert.Null(KosFileRules.CompareRefusal(null, null, mayCreate: true));
            Assert.Null(KosFileRules.CompareRefusal("", null, mayCreate: true));
        }

        [Fact]
        public void CompareRefusal_ANewFileWhereOneIs_IsRefused()
        {
            var refusal = KosFileRules.CompareRefusal(null, "abc", mayCreate: true);

            Assert.Equal(KosErrorCodes.FileExists, refusal!.ErrorCode);
            Assert.Equal("read the file before saving over it", refusal.Detail);
        }

        [Fact]
        public void CompareRefusal_TheHashReadMatches_GoesAhead()
        {
            Assert.Null(KosFileRules.CompareRefusal("ABC", "abc", mayCreate: false));
        }

        [Fact]
        public void CompareRefusal_AChangedFile_IsRefused()
        {
            var refusal = KosFileRules.CompareRefusal("abc", "def", mayCreate: true);

            Assert.Equal(KosErrorCodes.FileChanged, refusal!.ErrorCode);
            Assert.Equal("read the file again before saving over it", refusal.Detail);
        }

        [Fact]
        public void CompareRefusal_AFileThatHasGone_IsRefusedAsChanged()
        {
            var refusal = KosFileRules.CompareRefusal("abc", null, mayCreate: false);

            Assert.Equal(KosErrorCodes.FileChanged, refusal!.ErrorCode);
            Assert.Equal("the file is no longer there", refusal.Detail);
        }

        [Fact]
        public void CompareRefusal_NoHashWhereOneIsRequired_IsRefused()
        {
            Assert.Equal(KosErrorCodes.HashRequired, KosFileRules.CompareRefusal(null, "abc", mayCreate: false)!.ErrorCode);
        }

        [Fact]
        public void DriveFull_NamesWhatTheFileNeedsAndWhatIsFree()
        {
            var refusal = KosFileRules.DriveFull(5000, 1200);

            Assert.Equal(KosErrorCodes.DriveFull, refusal.ErrorCode);
            Assert.Equal("the file needs 5000 bytes and the drive has 1200 free", refusal.Detail);
        }

        [Fact]
        public void EveryFileRefusal_IsARefinementTheManifestCatalogues()
        {
            var catalogued = ErrorCodeCatalog.Of(typeof(KosErrorCodes)).Select(c => c.Id).ToList();

            foreach (var code in new[]
            {
                KosErrorCodes.BadPath, KosErrorCodes.FileType, KosErrorCodes.NotText, KosErrorCodes.FileTooLarge,
                KosErrorCodes.DriveFull, KosErrorCodes.FileChanged, KosErrorCodes.FileExists,
                KosErrorCodes.FileNotFound, KosErrorCodes.NotAFile, KosErrorCodes.HashRequired,
            })
            {
                Assert.False(code.IsRoot);
                Assert.Contains(code.Id, catalogued);
            }
        }

        [Fact]
        public void ReadFields_CarryTheTextAndItsHash()
        {
            var fields = KosFileRules.ReadFields("1:", "a.ks", "print 1.", "h", 8);

            Assert.Equal("read", fields["op"]);
            Assert.Equal("1:", fields["volume"]);
            Assert.Equal("a.ks", fields["path"]);
            Assert.Equal("print 1.", fields["text"]);
            Assert.Equal("h", fields["hash"]);
            Assert.Equal(8, fields["size"]);
        }
    }
}
