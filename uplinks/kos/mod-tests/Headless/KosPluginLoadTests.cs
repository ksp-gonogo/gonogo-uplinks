// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.RegularExpressions;
using Xunit;

namespace GonogoKosUplink.Tests.Headless
{
    /// <summary>
    /// KSP loads GonogoKosUplink.dll before kOS on a case-sensitive filesystem,
    /// and a type whose base type or interface is a kOS type cannot be loaded
    /// then, which drops the whole plugin. Such a type is built at runtime
    /// instead (<see cref="Gonogo.KosUplink.KosForwardingProxy"/>). A field
    /// typed with a kOS type is held to the ones the plugin has always carried
    /// and loaded with; a new one holds the value as <see cref="object"/>.
    /// </summary>
    public class KosPluginLoadTests
    {
        private static readonly string[] KosAssemblies = { "kOS", "kOS.Safe" };

        [Fact]
        public void ThePluginHasNoTypeThatDerivesFromOrImplementsAKosType()
        {
            var dll = typeof(KosPluginLoadTests).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
                .FirstOrDefault(a => a.Key == "KosPluginDll")?.Value;
            if (dll == null)
            {
                return; // The KSP reference set is absent, so the plugin was not built.
            }

            Assert.Empty(KosSubtypes(dll));
        }

        /*
         * Fields typed with a kOS type that loaded without trouble in every
         * release so far. Compiler-generated names carry a number that moves
         * with unrelated edits, so those are matched by pattern.
         */
        private static readonly Regex[] KnownKosFields =
        {
            new Regex(@"^Gonogo\.KosUplink\.ScreenDiffMapper::(_prev|_mapper|_lastScreenRef)$"),
            new Regex(@"^Gonogo\.KosUplink\.KosProcessorScreen::_resolve$"),
            new Regex(@"^Gonogo\.KosUplink\.KosExtension\+<>O::<\d+>__FindProcessor$"),
        };

        [Fact]
        public void ThePluginHasNoNewFieldTypedWithAKosType()
        {
            var dll = typeof(KosPluginLoadTests).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
                .FirstOrDefault(a => a.Key == "KosPluginDll")?.Value;
            if (dll == null)
            {
                return;
            }

            Assert.Empty(KosFields(dll).Where(f => !KnownKosFields.Any(r => r.IsMatch(f))));
        }

        /// <summary>The test assembly holds kOS-typed fields, so the field scan must find them here.</summary>
        [Fact]
        public void TheFieldScanFindsAKosField()
        {
            Assert.NotEmpty(KosFields(typeof(KosPluginLoadTests).Assembly.Location));
        }

        private static List<string> KosFields(string dll)
        {
            using var stream = File.OpenRead(dll);
            using var pe = new PEReader(stream);
            var md = pe.GetMetadataReader();
            var provider = new AssemblyNames(md);
            var found = new List<string>();
            foreach (var handle in md.TypeDefinitions)
            {
                var type = md.GetTypeDefinition(handle);
                foreach (var fieldHandle in type.GetFields())
                {
                    var field = md.GetFieldDefinition(fieldHandle);
                    if (field.DecodeSignature(provider, null).Any(a => KosAssemblies.Contains(a)))
                    {
                        found.Add(FullName(md, type) + "::" + md.GetString(field.Name));
                    }
                }
            }
            return found;
        }

        /// <summary>This test assembly implements kOS's ILogger, so the scan must find it here.</summary>
        [Fact]
        public void TheScanFindsAKosSubtype()
        {
            Assert.Contains(
                typeof(KosRunErrorCaptureTests).FullName + "+RecordingLogger",
                KosSubtypes(typeof(KosPluginLoadTests).Assembly.Location));
        }

        private static List<string> KosSubtypes(string dll)
        {
            using var stream = File.OpenRead(dll);
            using var pe = new PEReader(stream);
            var md = pe.GetMetadataReader();
            var found = new List<string>();
            foreach (var handle in md.TypeDefinitions)
            {
                var type = md.GetTypeDefinition(handle);
                var supertypes = new List<EntityHandle>();
                if (!type.BaseType.IsNil)
                {
                    supertypes.Add(type.BaseType);
                }
                supertypes.AddRange(type.GetInterfaceImplementations().Select(i => md.GetInterfaceImplementation(i).Interface));
                if (supertypes.Any(s => Assemblies(md, s).Any(a => KosAssemblies.Contains(a))))
                {
                    found.Add(FullName(md, type));
                }
            }
            return found;
        }

        private static string FullName(MetadataReader md, TypeDefinition type)
        {
            var declaring = type.GetDeclaringType();
            return declaring.IsNil
                ? md.GetString(type.Namespace) + "." + md.GetString(type.Name)
                : FullName(md, md.GetTypeDefinition(declaring)) + "+" + md.GetString(type.Name);
        }

        /// <summary>The assemblies a base type or interface reference names, including a generic one's arguments.</summary>
        private static IEnumerable<string> Assemblies(MetadataReader md, EntityHandle handle)
        {
            switch (handle.Kind)
            {
                case HandleKind.TypeReference:
                    return new[] { AssemblyOf(md, (TypeReferenceHandle)handle) };
                case HandleKind.TypeSpecification:
                    return md.GetTypeSpecification((TypeSpecificationHandle)handle).DecodeSignature(new AssemblyNames(md), null);
                default:
                    return Array.Empty<string>();
            }
        }

        private static string AssemblyOf(MetadataReader md, TypeReferenceHandle handle)
        {
            var reference = md.GetTypeReference(handle);
            switch (reference.ResolutionScope.Kind)
            {
                case HandleKind.AssemblyReference:
                    return md.GetString(md.GetAssemblyReference((AssemblyReferenceHandle)reference.ResolutionScope).Name);
                case HandleKind.TypeReference:
                    return AssemblyOf(md, (TypeReferenceHandle)reference.ResolutionScope);
                default:
                    return "";
            }
        }

        private sealed class AssemblyNames : ISignatureTypeProvider<IEnumerable<string>, object?>
        {
            private static readonly IEnumerable<string> None = Array.Empty<string>();
            private readonly MetadataReader _md;

            public AssemblyNames(MetadataReader md) => _md = md;

            public IEnumerable<string> GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind) =>
                new[] { AssemblyOf(_md, handle) };

            public IEnumerable<string> GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind) => None;

            public IEnumerable<string> GetGenericInstantiation(IEnumerable<string> genericType, ImmutableArray<IEnumerable<string>> typeArguments) =>
                genericType.Concat(typeArguments.SelectMany(a => a));

            public IEnumerable<string> GetPrimitiveType(PrimitiveTypeCode typeCode) => None;

            public IEnumerable<string> GetSZArrayType(IEnumerable<string> elementType) => elementType;

            public IEnumerable<string> GetArrayType(IEnumerable<string> elementType, ArrayShape shape) => elementType;

            public IEnumerable<string> GetByReferenceType(IEnumerable<string> elementType) => elementType;

            public IEnumerable<string> GetPointerType(IEnumerable<string> elementType) => elementType;

            public IEnumerable<string> GetPinnedType(IEnumerable<string> elementType) => elementType;

            public IEnumerable<string> GetGenericTypeParameter(object? genericContext, int index) => None;

            public IEnumerable<string> GetGenericMethodParameter(object? genericContext, int index) => None;

            public IEnumerable<string> GetFunctionPointerType(MethodSignature<IEnumerable<string>> signature) => None;

            public IEnumerable<string> GetModifiedType(IEnumerable<string> modifier, IEnumerable<string> unmodifiedType, bool isRequired) => unmodifiedType;

            public IEnumerable<string> GetTypeFromSpecification(MetadataReader reader, object? genericContext, TypeSpecificationHandle handle, byte rawTypeKind) =>
                reader.GetTypeSpecification(handle).DecodeSignature(this, genericContext);
        }
    }
}
