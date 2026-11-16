// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.IO;
using System.Text;
using Gonogo.KosUplink;
using kOS.Safe;
using kOS.Safe.Persistence;
using Sitrep.Contract;
using Xunit;

namespace GonogoKosUplink.Tests.Headless
{
    /// <summary>
    /// The <c>kos.files.*</c> commands against a real kOS CPU drive
    /// (<see cref="Harddisk"/>): what each answers, and that a refusal leaves
    /// the drive as it was.
    /// </summary>
    public class KosFileOpsHarddiskTests
    {
        private const string Drive = "1:";

        private static Harddisk DiskWith(int capacity, string path, string text)
        {
            var disk = new Harddisk(capacity);
            disk.SaveFile(VolumePath.FromString(path), new FileContent(text));
            return disk;
        }

        private static string TextAt(Volume volume, string path) =>
            ((VolumeFile)volume.Open(VolumePath.FromString(path))).ReadAll().String;

        private static string HashOf(string text) => KosFileRules.Hash(Encoding.UTF8.GetBytes(text));

        [Fact]
        public void Read_AnswersTheTextItsHashAndItsSize()
        {
            var disk = DiskWith(5000, "lib/a.ks", "print 1.\n");

            var outcome = KosFileOps.Read(disk, Drive, "lib/a.ks");

            Assert.Null(outcome.Refusal);
            Assert.Equal("read", outcome.Fields!["op"]);
            Assert.Equal("1:", outcome.Fields["volume"]);
            Assert.Equal("lib/a.ks", outcome.Fields["path"]);
            Assert.Equal("print 1.\n", outcome.Fields["text"]);
            Assert.Equal(HashOf("print 1.\n"), outcome.Fields["hash"]);
            Assert.Equal(9, outcome.Fields["size"]);
        }

        [Fact]
        public void Read_NoFileThere_IsRefusedAsNotFound()
        {
            var outcome = KosFileOps.Read(new Harddisk(5000), Drive, "missing.ks");

            Assert.Equal(KosErrorCodes.FileNotFound, outcome.Refusal!.ErrorCode);
        }

        [Fact]
        public void Read_ADirectory_IsRefused()
        {
            var disk = new Harddisk(5000);
            disk.CreateDirectory(VolumePath.FromString("lib.ks"));

            Assert.Equal(KosErrorCodes.NotAFile, KosFileOps.Read(disk, Drive, "lib.ks").Refusal!.ErrorCode);
        }

        [Fact]
        public void Read_BytesThatAreNotText_AreRefused()
        {
            var disk = new Harddisk(5000);
            disk.SaveFile(VolumePath.FromString("a.ks"), new FileContent(new byte[] { 0x6b, 0x03, 0x58, 0xff, 0xfe }));

            Assert.Equal(KosErrorCodes.NotText, KosFileOps.Read(disk, Drive, "a.ks").Refusal!.ErrorCode);
        }

        [Fact]
        public void Read_ABadPath_IsRefusedBeforeTheDriveIsTouched()
        {
            Assert.Equal(KosErrorCodes.BadPath, KosFileOps.Read(new Harddisk(5000), Drive, "../a.ks").Refusal!.ErrorCode);
        }

        [Fact]
        public void Write_ANewFile_SavesItAndAnswersItsHash()
        {
            var disk = new Harddisk(5000);

            var outcome = KosFileOps.Write(disk, Drive, "lib/new.ks", "print 2.\r\n", null);

            Assert.Null(outcome.Refusal);
            Assert.Equal("write", outcome.Fields!["op"]);
            Assert.Equal(HashOf("print 2.\n"), outcome.Fields["hash"]);
            Assert.Equal(9, outcome.Fields["size"]);
            Assert.Equal("print 2.\n", TextAt(disk, "lib/new.ks"));
        }

        [Fact]
        public void Write_ANewFileWhereOneAlreadyIs_IsRefusedAndLeavesIt()
        {
            var disk = DiskWith(5000, "a.ks", "theirs");

            var outcome = KosFileOps.Write(disk, Drive, "a.ks", "mine", null);

            Assert.Equal(KosErrorCodes.FileExists, outcome.Refusal!.ErrorCode);
            Assert.Equal("theirs", TextAt(disk, "a.ks"));
        }

        [Fact]
        public void Write_WithTheHashLastRead_SavesOverTheFile()
        {
            var disk = DiskWith(5000, "a.ks", "old");
            var read = KosFileOps.Read(disk, Drive, "a.ks");

            var outcome = KosFileOps.Write(disk, Drive, "a.ks", "new", (string)read.Fields!["hash"]!);

            Assert.Null(outcome.Refusal);
            Assert.Equal("new", TextAt(disk, "a.ks"));
            Assert.Equal(HashOf("new"), outcome.Fields!["hash"]);
        }

        /// <summary>A script's <c>LOG</c> appends through the same kOS call, between a screen's read and its save.</summary>
        [Fact]
        public void Write_AfterTheFileChangedInTheGame_IsRefusedAndKeepsTheGamesChange()
        {
            var disk = DiskWith(5000, "a.ks", "old");
            var read = KosFileOps.Read(disk, Drive, "a.ks");
            ((VolumeFile)disk.Open(VolumePath.FromString("a.ks"))).WriteLn("logged");

            var outcome = KosFileOps.Write(disk, Drive, "a.ks", "new", (string)read.Fields!["hash"]!);

            Assert.Equal(KosErrorCodes.FileChanged, outcome.Refusal!.ErrorCode);
            Assert.Equal("oldlogged\n", TextAt(disk, "a.ks"));
        }

        [Fact]
        public void Write_AfterTheFileWasDeleted_IsRefusedAsChanged()
        {
            var disk = DiskWith(5000, "a.ks", "old");
            var hash = (string)KosFileOps.Read(disk, Drive, "a.ks").Fields!["hash"]!;
            disk.Delete(VolumePath.FromString("a.ks"));

            var outcome = KosFileOps.Write(disk, Drive, "a.ks", "new", hash);

            Assert.Equal(KosErrorCodes.FileChanged, outcome.Refusal!.ErrorCode);
            Assert.False(disk.Exists(VolumePath.FromString("a.ks")));
        }

        [Fact]
        public void Write_ThatDoesNotFitOnTheDrive_IsRefusedAndWritesNothing()
        {
            var disk = DiskWith(100, "a.ks", new string('x', 60));

            var outcome = KosFileOps.Write(disk, Drive, "b.ks", new string('y', 50), null);

            Assert.Equal(KosErrorCodes.DriveFull, outcome.Refusal!.ErrorCode);
            Assert.Equal("the file needs 50 bytes and the drive has 40 free", outcome.Refusal.Detail);
            Assert.False(disk.Exists(VolumePath.FromString("b.ks")));
        }

        [Fact]
        public void Write_OverAFile_CountsTheRoomItsOldContentFrees()
        {
            var disk = DiskWith(100, "a.ks", new string('x', 60));
            var hash = (string)KosFileOps.Read(disk, Drive, "a.ks").Fields!["hash"]!;

            var outcome = KosFileOps.Write(disk, Drive, "a.ks", new string('y', 90), hash);

            Assert.Null(outcome.Refusal);
            Assert.Equal(new string('y', 90), TextAt(disk, "a.ks"));
        }

        [Fact]
        public void Write_TextOverTheCap_IsRefused()
        {
            var disk = new Harddisk(1_000_000);

            var outcome = KosFileOps.Write(disk, Drive, "a.ks", new string('a', KosFileRules.MaxFileBytes + 1), null);

            Assert.Equal(KosErrorCodes.FileTooLarge, outcome.Refusal!.ErrorCode);
            Assert.False(disk.Exists(VolumePath.FromString("a.ks")));
        }

        [Fact]
        public void Write_OverADirectory_IsRefused()
        {
            var disk = new Harddisk(5000);
            disk.CreateDirectory(VolumePath.FromString("lib.ks"));

            Assert.Equal(KosErrorCodes.NotAFile, KosFileOps.Write(disk, Drive, "lib.ks", "x", null).Refusal!.ErrorCode);
        }

        [Fact]
        public void Write_ThroughAFileUsedAsAFolder_FailsWithAnErrorNamingThePath()
        {
            var disk = DiskWith(5000, "lib", "not a folder");

            var outcome = KosFileOps.Write(disk, Drive, "lib/a.ks", "x", null);

            Assert.Null(outcome.Refusal);
            Assert.StartsWith("could not use 1:lib/a.ks: ", outcome.Error);
        }

        [Fact]
        public void Delete_WithTheHashLastRead_DeletesTheFile()
        {
            var disk = DiskWith(5000, "a.ks", "x");

            var outcome = KosFileOps.Delete(disk, Drive, "a.ks", HashOf("x"));

            Assert.Equal("delete", outcome.Fields!["op"]);
            Assert.False(disk.Exists(VolumePath.FromString("a.ks")));
        }

        [Fact]
        public void Delete_AChangedFile_IsRefusedAndKeepsIt()
        {
            var disk = DiskWith(5000, "a.ks", "changed");

            Assert.Equal(KosErrorCodes.FileChanged, KosFileOps.Delete(disk, Drive, "a.ks", HashOf("x")).Refusal!.ErrorCode);
            Assert.True(disk.Exists(VolumePath.FromString("a.ks")));
        }

        [Fact]
        public void Delete_WithNoHash_IsRefused()
        {
            var disk = DiskWith(5000, "a.ks", "x");

            Assert.Equal(KosErrorCodes.HashRequired, KosFileOps.Delete(disk, Drive, "a.ks", null).Refusal!.ErrorCode);
            Assert.True(disk.Exists(VolumePath.FromString("a.ks")));
        }

        [Fact]
        public void Rename_MovesTheFileAndAnswersItsHash()
        {
            var disk = DiskWith(5000, "a.ks", "x");

            var outcome = KosFileOps.Rename(disk, Drive, "a.ks", "lib/b.ks", HashOf("x"));

            Assert.Equal("rename", outcome.Fields!["op"]);
            Assert.Equal("lib/b.ks", outcome.Fields["newPath"]);
            Assert.Equal(HashOf("x"), outcome.Fields["hash"]);
            Assert.False(disk.Exists(VolumePath.FromString("a.ks")));
            Assert.Equal("x", TextAt(disk, "lib/b.ks"));
        }

        [Fact]
        public void Rename_OnAFullDrive_StillMovesTheFile()
        {
            var disk = DiskWith(10, "a.ks", new string('x', 10));

            Assert.Null(KosFileOps.Rename(disk, Drive, "a.ks", "b.ks", HashOf(new string('x', 10))).Refusal);
            Assert.Equal(new string('x', 10), TextAt(disk, "b.ks"));
        }

        [Fact]
        public void Rename_OntoAFileThatExists_IsRefusedAndMovesNothing()
        {
            var disk = DiskWith(5000, "a.ks", "x");
            disk.SaveFile(VolumePath.FromString("b.ks"), new FileContent("y"));

            var outcome = KosFileOps.Rename(disk, Drive, "a.ks", "b.ks", HashOf("x"));

            Assert.Equal(KosErrorCodes.FileExists, outcome.Refusal!.ErrorCode);
            Assert.Equal("x", TextAt(disk, "a.ks"));
            Assert.Equal("y", TextAt(disk, "b.ks"));
        }

        [Fact]
        public void Rename_AChangedFile_IsRefused()
        {
            var disk = DiskWith(5000, "a.ks", "changed");

            Assert.Equal(KosErrorCodes.FileChanged, KosFileOps.Rename(disk, Drive, "a.ks", "b.ks", HashOf("x")).Refusal!.ErrorCode);
            Assert.True(disk.Exists(VolumePath.FromString("a.ks")));
        }

        [Fact]
        public void Rename_WithNoHash_IsRefused()
        {
            var disk = DiskWith(5000, "a.ks", "x");

            Assert.Equal(KosErrorCodes.HashRequired, KosFileOps.Rename(disk, Drive, "a.ks", "b.ks", "").Refusal!.ErrorCode);
        }

        [Fact]
        public void Rename_ToABadPath_IsRefused()
        {
            var disk = DiskWith(5000, "a.ks", "x");

            Assert.Equal(KosErrorCodes.BadPath, KosFileOps.Rename(disk, Drive, "a.ks", "../b.ks", HashOf("x")).Refusal!.ErrorCode);
            Assert.Equal(KosErrorCodes.FileType, KosFileOps.Rename(disk, Drive, "a.ks", "b.exe", HashOf("x")).Refusal!.ErrorCode);
            Assert.True(disk.Exists(VolumePath.FromString("a.ks")));
        }
    }

    /// <summary>
    /// The <c>kos.files.*</c> commands against a real kOS Archive over a
    /// temporary folder. One class, so its tests never run beside each other:
    /// kOS keeps the Archive's folder in a static.
    /// </summary>
    public sealed class KosFileOpsArchiveTests : IDisposable
    {
        private const string Arc = "0:";
        private readonly string _root;
        private readonly string _folder;
        private readonly Archive _archive;

        public KosFileOpsArchiveTests()
        {
            _root = Path.Combine(Path.GetTempPath(), "gonogo-kos-files-" + Guid.NewGuid().ToString("N"));
            _folder = Path.Combine(_root, "Script");
            _archive = new Archive(_folder);
        }

        public void Dispose() => Directory.Delete(_root, true);

        [Fact]
        public void WriteThenRead_RoundTripsThroughTheFolder()
        {
            var written = KosFileOps.Write(_archive, Arc, "lib/a.ks", "print 1.\n", null);
            var read = KosFileOps.Read(_archive, Arc, "lib/a.ks");

            Assert.True(File.Exists(Path.Combine(_folder, "lib", "a.ks")));
            Assert.Equal("print 1.\n", read.Fields!["text"]);
            Assert.Equal(written.Fields!["hash"], read.Fields["hash"]);
        }

        [Fact]
        public void AFileEditedOnDisk_RefusesTheSave()
        {
            KosFileOps.Write(_archive, Arc, "a.ks", "old", null);
            var hash = (string)KosFileOps.Read(_archive, Arc, "a.ks").Fields!["hash"]!;
            File.WriteAllText(Path.Combine(_folder, "a.ks"), "edited in a text editor");

            var outcome = KosFileOps.Write(_archive, Arc, "a.ks", "new", hash);

            Assert.Equal(KosErrorCodes.FileChanged, outcome.Refusal!.ErrorCode);
            Assert.Equal("edited in a text editor", File.ReadAllText(Path.Combine(_folder, "a.ks")));
        }

        [Fact]
        public void APathOutOfTheFolder_IsRefusedAndNothingIsWrittenOutside()
        {
            var outcome = KosFileOps.Write(_archive, Arc, "../escape.ks", "x", null);

            Assert.Equal(KosErrorCodes.BadPath, outcome.Refusal!.ErrorCode);
            Assert.False(File.Exists(Path.Combine(_root, "escape.ks")));
        }

        [Fact]
        public void TheArchiveHasNoCapacity_SoALargeWriteUpToTheCapFits()
        {
            var outcome = KosFileOps.Write(_archive, Arc, "big.txt", new string('a', KosFileRules.MaxFileBytes), null);

            Assert.Null(outcome.Refusal);
        }

        [Fact]
        public void AFileOverTheCapOnDisk_IsRefusedOnRead()
        {
            File.WriteAllText(Path.Combine(_folder, "big.txt"), new string('a', KosFileRules.MaxFileBytes + 1));

            Assert.Equal(KosErrorCodes.FileTooLarge, KosFileOps.Read(_archive, Arc, "big.txt").Refusal!.ErrorCode);
        }

        [Fact]
        public void DeleteAndRename_ActOnTheFolder()
        {
            KosFileOps.Write(_archive, Arc, "a.ks", "x", null);
            var hash = KosFileRules.Hash(Encoding.UTF8.GetBytes("x"));

            Assert.Null(KosFileOps.Rename(_archive, Arc, "a.ks", "b.ks", hash).Refusal);
            Assert.False(File.Exists(Path.Combine(_folder, "a.ks")));
            Assert.Null(KosFileOps.Delete(_archive, Arc, "b.ks", hash).Refusal);
            Assert.False(File.Exists(Path.Combine(_folder, "b.ks")));
        }
    }
}
