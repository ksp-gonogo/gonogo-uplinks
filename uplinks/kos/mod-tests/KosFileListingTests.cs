using System.Collections.Generic;
using Gonogo.KosUplink;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// The <c>kos.files.list</c> answer: the exact field shape the script
    /// picker parses, with an unreported size or kind carried as JSON null.
    /// </summary>
    public class KosFileListingTests
    {
        [Fact]
        public void Fields_CarryTheVolumeAndTheListing()
        {
            var fields = KosFileListing.Fields("0:", new[]
            {
                new KosListedFile("hello.ks", 42, false),
                new KosListedFile("lib", 0, true),
            });

            Assert.Equal("list", fields["op"]);
            Assert.Equal("0:", fields["path"]);
            Assert.Equal(
                "[{\"name\":\"hello.ks\",\"size\":42,\"isDir\":false},{\"name\":\"lib\",\"size\":0,\"isDir\":true}]",
                fields["listing"]);
        }

        [Fact]
        public void AnUnreportedSizeOrKind_IsNullNotZeroOrFalse()
        {
            var json = KosFileListing.Json(new[] { new KosListedFile("a.ks", null, null) });

            Assert.Equal("[{\"name\":\"a.ks\",\"size\":null,\"isDir\":null}]", json);
        }

        [Fact]
        public void AnEmptyVolume_IsAnEmptyArray()
        {
            Assert.Equal("[]", KosFileListing.Json(new List<KosListedFile>()));
        }

        [Fact]
        public void QuotesAndControlCharactersInANameAreEscaped()
        {
            var json = KosFileListing.Json(new[] { new KosListedFile("a\"b\\c\n", 1, false) });

            Assert.Equal("[{\"name\":\"a\\\"b\\\\c\\n\",\"size\":1,\"isDir\":false}]", json);
        }
    }
}
