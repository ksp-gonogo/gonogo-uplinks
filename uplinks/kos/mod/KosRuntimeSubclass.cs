// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using System.Reflection;
using System.Reflection.Emit;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Builds, at runtime, a sealed subclass of a class that takes one
    /// constructor argument: its constructor passes the argument to the base
    /// constructor, then registers named members through a protected base
    /// method, and each abstract method it overrides returns what a static hook
    /// returns.
    ///
    /// <para>This is how the Uplink derives from a kOS class. A type in
    /// GonogoKosUplink.dll that derived from one could not be loaded when KSP
    /// enumerates the plugin, which on a case-sensitive filesystem happens
    /// before kOS loads, and the whole plugin would drop. A class built here is
    /// made only once kOS is running. Every hook is a public static method
    /// taking and returning <see cref="object"/>, so the plugin names no kOS
    /// type in a signature either.</para>
    /// </summary>
    public static class KosRuntimeSubclass
    {
        private static ModuleBuilder? _module;
        private static readonly object Gate = new object();

        /// <summary>
        /// The subclass of <paramref name="baseType"/>. Its constructor takes a
        /// <paramref name="ctorParameter"/>, calls the base constructor with it,
        /// then for each entry of <paramref name="members"/> calls
        /// <paramref name="addMember"/> on itself with the entry's name and what
        /// the entry's factory returns for the constructor argument. Each entry
        /// of <paramref name="overrides"/> implements an abstract method that
        /// takes no arguments by returning the hook's result.
        /// </summary>
        public static Type Build(
            Type baseType,
            Type ctorParameter,
            MethodInfo addMember,
            IReadOnlyList<KeyValuePair<string, MethodInfo>> members,
            IReadOnlyList<KeyValuePair<MethodInfo, MethodInfo>> overrides,
            IEnumerable<CustomAttributeBuilder> attributes)
        {
            var baseCtor = baseType.GetConstructor(
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic, null, new[] { ctorParameter }, null)
                ?? throw new ArgumentException(baseType + " has no constructor taking " + ctorParameter, nameof(baseType));
            var memberType = addMember.GetParameters()[1].ParameterType;

            lock (Gate)
            {
                _module ??= AssemblyBuilder
                    .DefineDynamicAssembly(new AssemblyName("GonogoKosUplink.Subclasses"), AssemblyBuilderAccess.Run)
                    .DefineDynamicModule("GonogoKosUplink.Subclasses");

                var type = _module.DefineType(
                    "Gonogo.KosUplink.Subclasses." + baseType.Name + Guid.NewGuid().ToString("N"),
                    TypeAttributes.Public | TypeAttributes.Sealed | TypeAttributes.Class,
                    baseType);
                foreach (var attribute in attributes)
                {
                    type.SetCustomAttribute(attribute);
                }

                var ctor = type.DefineConstructor(MethodAttributes.Public, CallingConventions.Standard, new[] { ctorParameter });
                var il = ctor.GetILGenerator();
                il.Emit(OpCodes.Ldarg_0);
                il.Emit(OpCodes.Ldarg_1);
                il.Emit(OpCodes.Call, baseCtor);
                foreach (var member in members)
                {
                    il.Emit(OpCodes.Ldarg_0);
                    il.Emit(OpCodes.Ldstr, member.Key);
                    il.Emit(OpCodes.Ldarg_1);
                    il.Emit(OpCodes.Call, member.Value);
                    il.Emit(OpCodes.Castclass, memberType);
                    il.Emit(OpCodes.Call, addMember);
                }
                il.Emit(OpCodes.Ret);

                foreach (var pair in overrides)
                {
                    var target = pair.Key;
                    var method = type.DefineMethod(
                        target.Name,
                        (target.Attributes & MethodAttributes.MemberAccessMask) | MethodAttributes.Virtual | MethodAttributes.HideBySig,
                        target.ReturnType,
                        Type.EmptyTypes);
                    il = method.GetILGenerator();
                    il.Emit(OpCodes.Call, pair.Value);
                    il.Emit(OpCodes.Castclass, target.ReturnType);
                    il.Emit(OpCodes.Ret);
                    type.DefineMethodOverride(method, target);
                }

                return type.CreateType()!;
            }
        }
    }
}
