// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Builds, at runtime, a class that implements an interface by forwarding
    /// every call to an inner instance of it, and passes the arguments of one
    /// chosen method to a hook before forwarding that call.
    ///
    /// <para>This is how the Uplink implements a kOS interface. KSP loads
    /// GonogoKosUplink.dll before kOS on a case-sensitive filesystem, and a type
    /// in it that implemented a kOS interface could not be loaded then, which
    /// drops the whole plugin. A class built here is made only once kOS is
    /// running, so the plugin assembly itself never names a kOS type as a base
    /// type or an interface.</para>
    /// </summary>
    public static class KosForwardingProxy
    {
        private static ModuleBuilder? _module;
        private static readonly object Gate = new object();

        /// <summary>
        /// A factory for forwarding proxies of <paramref name="interfaceType"/>:
        /// it takes the inner instance and the hook, and returns the proxy.
        /// <paramref name="intercepted"/> must be one of the interface's own
        /// methods; its arguments reach the hook boxed, in order.
        /// </summary>
        public static Func<object, Action<object?[]>, object> Factory(Type interfaceType, MethodInfo intercepted, out Type proxyType)
        {
            if (!interfaceType.IsInterface)
            {
                throw new ArgumentException(interfaceType + " is not an interface", nameof(interfaceType));
            }
            var methods = interfaceType.GetMethods();
            if (!methods.Contains(intercepted))
            {
                throw new ArgumentException(intercepted + " is not a method of " + interfaceType, nameof(intercepted));
            }

            lock (Gate)
            {
                _module ??= AssemblyBuilder
                    .DefineDynamicAssembly(new AssemblyName("GonogoKosUplink.Proxies"), AssemblyBuilderAccess.Run)
                    .DefineDynamicModule("GonogoKosUplink.Proxies");

                var type = _module.DefineType(
                    "Gonogo.KosUplink.Proxies." + interfaceType.Name + "Forwarder" + Guid.NewGuid().ToString("N"),
                    TypeAttributes.Public | TypeAttributes.Sealed | TypeAttributes.Class,
                    typeof(object),
                    new[] { interfaceType });
                var inner = type.DefineField("_inner", interfaceType, FieldAttributes.Private | FieldAttributes.InitOnly);
                var hook = type.DefineField("_hook", typeof(Action<object?[]>), FieldAttributes.Private | FieldAttributes.InitOnly);

                var ctor = type.DefineConstructor(
                    MethodAttributes.Public, CallingConventions.Standard, new[] { typeof(object), typeof(Action<object?[]>) });
                var il = ctor.GetILGenerator();
                il.Emit(OpCodes.Ldarg_0);
                il.Emit(OpCodes.Call, typeof(object).GetConstructor(Type.EmptyTypes)!);
                il.Emit(OpCodes.Ldarg_0);
                il.Emit(OpCodes.Ldarg_1);
                il.Emit(OpCodes.Castclass, interfaceType);
                il.Emit(OpCodes.Stfld, inner);
                il.Emit(OpCodes.Ldarg_0);
                il.Emit(OpCodes.Ldarg_2);
                il.Emit(OpCodes.Stfld, hook);
                il.Emit(OpCodes.Ret);

                foreach (var method in methods)
                {
                    var parameters = method.GetParameters().Select(p => p.ParameterType).ToArray();
                    var impl = type.DefineMethod(
                        interfaceType.Name + "." + method.Name,
                        MethodAttributes.Private | MethodAttributes.Virtual | MethodAttributes.Final
                            | MethodAttributes.HideBySig | MethodAttributes.NewSlot,
                        method.ReturnType,
                        parameters);
                    il = impl.GetILGenerator();
                    if (method == intercepted)
                    {
                        il.Emit(OpCodes.Ldarg_0);
                        il.Emit(OpCodes.Ldfld, hook);
                        il.Emit(OpCodes.Ldc_I4, parameters.Length);
                        il.Emit(OpCodes.Newarr, typeof(object));
                        for (var i = 0; i < parameters.Length; i++)
                        {
                            il.Emit(OpCodes.Dup);
                            il.Emit(OpCodes.Ldc_I4, i);
                            il.Emit(OpCodes.Ldarg, i + 1);
                            if (parameters[i].IsValueType)
                            {
                                il.Emit(OpCodes.Box, parameters[i]);
                            }
                            il.Emit(OpCodes.Stelem_Ref);
                        }
                        il.Emit(OpCodes.Callvirt, typeof(Action<object?[]>).GetMethod("Invoke")!);
                    }
                    il.Emit(OpCodes.Ldarg_0);
                    il.Emit(OpCodes.Ldfld, inner);
                    for (var i = 0; i < parameters.Length; i++)
                    {
                        il.Emit(OpCodes.Ldarg, i + 1);
                    }
                    il.Emit(OpCodes.Callvirt, method);
                    il.Emit(OpCodes.Ret);
                    type.DefineMethodOverride(impl, method);
                }

                var built = type.CreateType()!;
                proxyType = built;
                return (innerInstance, hookAction) => Activator.CreateInstance(built, innerInstance, hookAction)!;
            }
        }
    }
}
