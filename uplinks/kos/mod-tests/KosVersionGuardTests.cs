using System;
using System.Collections.Generic;
using System.Linq;
using Gonogo.KosUplink;
using Xunit;

namespace GonogoKosUplink.Tests
{
    // Fakes matched by SIMPLE NAME, exactly as production resolves the real kOS
    // types (KosVersionGuard.ProbeTypes matches Type.Name). These carry the
    // member NAMES/shapes the guard requires so the probe can be exercised with
    // no real kOS.dll present: the same technique GonogoScansatUplink's
    // VersionGuard tests use.
    namespace Fakes
    {
#pragma warning disable IDE1006 // intentionally lower-cased to match kOS's real type name
        public class kOSProcessor
        {
            public static List<object> AllInstances() => new List<object>();
            public object? GetScreen() => null;
            public object? GetWindow() => null;
            public object? HardDisk { get; set; }
            public object? Archive { get; set; }
            public string Tag { get; set; } = "";
            public int KOSCoreId { get; set; }
            public bool HasBooted { get; set; }
            public object? BootFilePath { get; set; }
            public int ProcessorMode { get; set; }
#pragma warning disable CS0169, CS0649 // read only by reflection, as the real field is
            private SharedObjects? shared;
#pragma warning restore CS0169, CS0649
        }
#pragma warning restore IDE1006

        public interface ILogger
        {
        }

        public class SharedObjects
        {
            public ILogger? Logger { get; set; }
        }

        public interface IInterpreter
        {
            void SetInputLock(bool isLocked);
            bool IsAtStartOfCommand();
            bool IsWaitingForCommand();
        }

        public class TermWindow
        {
            // The pinned 4-arg overload shape (char, _, bool, bool) plus the
            // 3-arg + 2-arg siblings the guard must disambiguate from.
            public bool ProcessOneInputChar(char ch, object? whichTelnet, bool allowQueue, bool forceQueue) => true;
            public void ProcessOneInputChar(char ch, object? whichTelnet, bool allowQueue) { }
            public void ProcessOneInputChar(char ch, object? whichTelnet) { }
        }

        public interface ICpu
        {
            void SetGlobal(string identifier, object value);
            void RemoveVariable(string identifier);
            object SwitchToProgramContext();
            void YieldProgram(object yieldTracker);
            List<int> GetCallTrace();
            object GetOpcodeAt(int instructionPtr);
        }

        public class YieldFinishedCompile
        {
            public static object? RunScript(object path, int line, string content, string context, object options) => null;
        }

        public interface IVolumeManager
        {
            object GlobalPathFromObject(object pathObject);
            object GetVolumeFromPath(object path);
        }

        public class Volume
        {
            public object? Open(object path, bool ksmDefault = false) => null;
            public bool IsRoomFor(object path, object content) => true;
            public object? SaveFile(object path, object content, bool verifyFreeSpace = true) => null;
        }

        public class Script
        {
            public void ClearContext(string contextId) { }
        }

        // A TermWindow whose ONLY ProcessOneInputChar is the non-pinned 3-arg
        // overload: the ambiguity the guard exists to catch.
        public class TermWindowThreeArgOnly
        {
            public void ProcessOneInputChar(char ch, object? whichTelnet, bool allowQueue) { }
        }
    }

    /// <summary>
    /// Headless tests for the kOS version guard (spec §7), assembly/member
    /// existence + the 4-arg <c>ProcessOneInputChar</c> overload pin, plus the
    /// native-run availability axis.
    /// </summary>
    public class KosVersionGuardTests
    {
        private static readonly Type[] NativeRunTypes =
        {
            typeof(Fakes.ICpu),
            typeof(Fakes.YieldFinishedCompile),
            typeof(Fakes.IVolumeManager),
            typeof(Fakes.Volume),
            typeof(Fakes.Script),
        };

        private static readonly Type[] FullSet = new[]
        {
            typeof(Fakes.kOSProcessor),
            typeof(Fakes.IInterpreter),
            typeof(Fakes.TermWindow),
        }.Concat(NativeRunTypes).ToArray();

        [Fact]
        public void Probe_NullAssemblies_FailSoft()
        {
            var r = KosVersionGuard.Probe(null, null);
            Assert.False(r.IsAvailable);
            Assert.Contains("not loaded", r.Reason);
        }

        [Fact]
        public void ProbeTypes_FullSet_AvailableWithNativeRun()
        {
            var r = KosVersionGuard.ProbeTypes(FullSet);
            Assert.True(r.IsAvailable);
            Assert.True(r.NativeRunAvailable);
        }

        [Fact]
        public void ProbeTypes_ANativeRunMemberMissing_AvailableButNoNativeRun()
        {
            var types = FullSet.Where(t => t.Name != "Script").ToList();
            var r = KosVersionGuard.ProbeTypes(types);
            Assert.True(r.IsAvailable);
            Assert.False(r.NativeRunAvailable);
            Assert.Contains("Script.ClearContext", KosVersionGuard.MissingNativeRunMembers(types));
        }

        [Fact]
        public void ProbeTypes_MissingCoreType_FailSoft()
        {
            var types = FullSet.Where(t => t.Name != "TermWindow").ToList();
            var r = KosVersionGuard.ProbeTypes(types);
            Assert.False(r.IsAvailable);
            Assert.Contains("TermWindow", r.Reason);
        }

        [Fact]
        public void ProbeTypes_MissingMember_FailSoftNamingMember()
        {
            // A kOSProcessor stand-in lacking KOSCoreId.
            var r = KosVersionGuard.ProbeTypes(new[]
            {
                typeof(FakesMissing.kOSProcessor),
                typeof(Fakes.IInterpreter),
                typeof(Fakes.TermWindow),
            });
            Assert.False(r.IsAvailable);
            Assert.Contains("KOSCoreId", r.Reason);
        }

        [Fact]
        public void ProbeTypes_NoSharedField_AvailableButNoNativeRun()
        {
            var r = KosVersionGuard.ProbeTypes(new[]
            {
                typeof(FakesNoShared.kOSProcessor),
                typeof(Fakes.IInterpreter),
                typeof(Fakes.TermWindow),
            }.Concat(NativeRunTypes).ToList());
            Assert.True(r.IsAvailable);
            Assert.False(r.NativeRunAvailable);
        }

        [Fact]
        public void SharedObjectsField_WrongFieldType_IsNotBound()
        {
            Assert.Null(KosVersionGuard.SharedObjectsField(typeof(FakesNoShared.WrongSharedType.kOSProcessor)));
        }

        [Fact]
        public void SharedObjectsField_LoggerWithoutPublicSetter_IsNotBound()
        {
            Assert.Null(KosVersionGuard.SharedObjectsField(typeof(FakesNoShared.ReadOnlyLogger.kOSProcessor)));
        }

        [Fact]
        public void CheckVersion_InRange_Clears()
        {
            Assert.Null(KosVersionGuard.CheckVersion(new Version(1, 6, 0, 1)));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(2)]
        public void CheckVersion_OutOfRange_FailSoft(int major)
        {
            var r = KosVersionGuard.CheckVersion(new Version(major, 0));
            Assert.NotNull(r);
            Assert.False(r!.Value.IsAvailable);
            Assert.Contains("known-good range", r.Value.Reason);
        }

        /// <summary>
        /// A version we could not read is not a version inside the pin.
        /// <c>AssemblyName.Version</c> is nullable, and treating null as
        /// in-range makes the whole version pin unreachable for exactly the
        /// assembly it can say least about. The guard's contract is that
        /// every failure mode degrades to <c>IsAvailable = false</c> with a
        /// reason, and "cannot confirm the version" is a failure mode.
        /// </summary>
        [Fact]
        public void CheckVersion_UnreadableVersion_FailSoftRatherThanAssumingInRange()
        {
            var r = KosVersionGuard.CheckVersion(null);
            Assert.NotNull(r);
            Assert.False(r!.Value.IsAvailable);
            Assert.Contains("version", r.Value.Reason);
        }

        [Fact]
        public void HasFourArgProcessOneInputChar_TrueForFourArgShape()
        {
            Assert.True(KosVersionGuard.HasFourArgProcessOneInputChar(typeof(Fakes.TermWindow)));
        }

        [Fact]
        public void HasFourArgProcessOneInputChar_FalseWhenOnlyThreeArg()
        {
            Assert.False(KosVersionGuard.HasFourArgProcessOneInputChar(typeof(Fakes.TermWindowThreeArgOnly)));
        }
    }

    // A processor stand-in (matched by simple name) missing the KOSCoreId
    // member: in a distinct namespace from Fakes so it doesn't clash.
    namespace FakesMissing
    {
#pragma warning disable IDE1006
        public class kOSProcessor
        {
            public static List<object> AllInstances() => new List<object>();
            public object? GetScreen() => null;
            public object? GetWindow() => null;
            public object? HardDisk { get; set; }
            public object? Archive { get; set; }
            public string Tag { get; set; } = "";
            // KOSCoreId intentionally absent.
            public bool HasBooted { get; set; }
            public object? BootFilePath { get; set; }
            public int ProcessorMode { get; set; }
        }
#pragma warning restore IDE1006
    }

    // Processor stand-ins whose shared field is absent or the wrong shape.
    namespace FakesNoShared
    {
#pragma warning disable IDE1006
        public class kOSProcessor
        {
            public static List<object> AllInstances() => new List<object>();
            public object? GetScreen() => null;
            public object? GetWindow() => null;
            public object? HardDisk { get; set; }
            public object? Archive { get; set; }
            public string Tag { get; set; } = "";
            public int KOSCoreId { get; set; }
            public bool HasBooted { get; set; }
            public object? BootFilePath { get; set; }
            public int ProcessorMode { get; set; }
        }

        namespace WrongSharedType
        {
            public class kOSProcessor
            {
#pragma warning disable CS0169
                private object? shared;
#pragma warning restore CS0169
            }
        }

        namespace ReadOnlyLogger
        {
            public class SharedObjects
            {
                public Fakes.ILogger? Logger { get; }
            }

            public class kOSProcessor
            {
#pragma warning disable CS0169
                private SharedObjects? shared;
#pragma warning restore CS0169
            }
        }
#pragma warning restore IDE1006
    }
}
