// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using Gonogo.KosUplink;
using kOS.Safe;
using kOS.UserIO;
using Xunit;

namespace GonogoKosUplink.Tests.Headless
{
    /// <summary>
    /// The run error capture against the kOS assemblies this Uplink is built
    /// against: the private field it reads must still be there with the type
    /// it expects, and the logger proxy it builds must forward everything kOS
    /// logs.
    /// </summary>
    public class KosRunErrorCaptureTests
    {
        /*
         * kOSProcessor derives from KSP's PartModule, so loading the type needs
         * Assembly-CSharp, which a headless run does not have. The field is read
         * from kOS.dll's metadata instead, which needs nothing loaded.
         */
        [Fact]
        public void KosDll_ProcessorStillHasTheSharedObjectsField()
        {
            var kosDll = typeof(TerminalXtermMapper).Assembly.Location;
            using var stream = File.OpenRead(kosDll);
            using var pe = new PEReader(stream);
            var md = pe.GetMetadataReader();

            var processor = md.TypeDefinitions
                .Select(md.GetTypeDefinition)
                .Single(t => md.GetString(t.Name) == "kOSProcessor" && md.GetString(t.Namespace) == "kOS.Module");
            var field = processor.GetFields()
                .Select(md.GetFieldDefinition)
                .SingleOrDefault(f => md.GetString(f.Name) == KosVersionGuard.SharedFieldName);

            Assert.True(
                field.Name != default(StringHandle),
                "kOS.Module.kOSProcessor no longer declares a field named '" + KosVersionGuard.SharedFieldName + "'");
            Assert.Equal("kOS." + KosVersionGuard.SharedFieldTypeName, field.DecodeSignature(new TypeNames(), null));
        }

        [Fact]
        public void KosSafe_LoggerIsAnILoggerWithAPublicSetter()
        {
            var logger = typeof(SafeSharedObjects).GetProperty("Logger");

            Assert.NotNull(logger);
            Assert.Equal(typeof(ILogger), logger!.PropertyType);
            Assert.NotNull(logger.GetSetMethod());
        }

        private static ILogger Proxy(ILogger inner, Action<object?[]> hook) =>
            (ILogger)KosForwardingProxy.Factory(
                typeof(ILogger),
                typeof(ILogger).GetMethod(nameof(ILogger.Log), new[] { typeof(Exception) })!,
                out _)(inner, hook);

        [Fact]
        public void KosSafe_HasEveryMemberTheNativeRunCalls()
        {
            Assert.Empty(KosVersionGuard.MissingNativeRunMembers(typeof(SafeSharedObjects).Assembly.GetTypes()));
        }

        [Fact]
        public void Proxy_ForwardsEveryCallAndHandsTheExceptionToTheHook()
        {
            var inner = new RecordingLogger();
            var errors = new List<string>();
            var logger = Proxy(inner, args => errors.Add(((Exception)args[0]!).Message));

            logger.Log("text");
            logger.SuperVerbose("verbose");
            logger.LogWarning("warning");
            logger.LogWarningAndScreen("screen");
            logger.LogException(new InvalidOperationException("logged"));
            logger.LogError("error");
            logger.Log(new InvalidOperationException("Undefined Variable Name 'x'."));

            Assert.Equal(
                new[] { "Log:text", "SuperVerbose:verbose", "LogWarning:warning", "LogWarningAndScreen:screen", "LogException:logged", "LogError:error", "LogEx:Undefined Variable Name 'x'." },
                inner.Calls);
            Assert.Equal(new[] { "Undefined Variable Name 'x'." }, errors);
        }

        [Fact]
        public void Proxy_IsBuiltOutsideThePluginAssembly()
        {
            var logger = Proxy(new RecordingLogger(), _ => { });

            Assert.NotEqual(typeof(KosForwardingProxy).Assembly, logger.GetType().Assembly);
            Assert.True(logger.GetType().Assembly.IsDynamic);
        }

        private sealed class RecordingLogger : ILogger
        {
            public List<string> Calls { get; } = new List<string>();

            public void Log(string text) => Calls.Add("Log:" + text);

            public void Log(Exception e) => Calls.Add("LogEx:" + e.Message);

            public void SuperVerbose(string s) => Calls.Add("SuperVerbose:" + s);

            public void LogWarning(string s) => Calls.Add("LogWarning:" + s);

            public void LogWarningAndScreen(string s) => Calls.Add("LogWarningAndScreen:" + s);

            public void LogException(Exception exception) => Calls.Add("LogException:" + exception.Message);

            public void LogError(string s) => Calls.Add("LogError:" + s);
        }

        /// <summary>Decodes a field signature to the namespace-qualified name of its type.</summary>
        private sealed class TypeNames : ISignatureTypeProvider<string, object?>
        {
            public string GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind)
            {
                var t = reader.GetTypeDefinition(handle);
                return reader.GetString(t.Namespace) + "." + reader.GetString(t.Name);
            }

            public string GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind)
            {
                var t = reader.GetTypeReference(handle);
                return reader.GetString(t.Namespace) + "." + reader.GetString(t.Name);
            }

            public string GetPrimitiveType(PrimitiveTypeCode typeCode) => typeCode.ToString();

            public string GetSZArrayType(string elementType) => elementType + "[]";

            public string GetArrayType(string elementType, ArrayShape shape) => elementType + "[,]";

            public string GetByReferenceType(string elementType) => elementType + "&";

            public string GetPointerType(string elementType) => elementType + "*";

            public string GetPinnedType(string elementType) => elementType;

            public string GetGenericInstantiation(string genericType, System.Collections.Immutable.ImmutableArray<string> typeArguments) =>
                genericType + "<" + string.Join(",", typeArguments) + ">";

            public string GetGenericTypeParameter(object? genericContext, int index) => "!" + index;

            public string GetGenericMethodParameter(object? genericContext, int index) => "!!" + index;

            public string GetFunctionPointerType(MethodSignature<string> signature) => "fnptr";

            public string GetModifiedType(string modifier, string unmodifiedType, bool isRequired) => unmodifiedType;

            public string GetTypeFromSpecification(MetadataReader reader, object? genericContext, TypeSpecificationHandle handle, byte rawTypeKind) =>
                "spec";
        }
    }
}
