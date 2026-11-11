using System;
using System.Reflection;
using GonogoPrincipiaUplink;

namespace GonogoPrinProbe
{
    /// <summary>
    /// The value a Principia call's body parameter takes for one body: the game's body
    /// index up to 2026101016-Lichnerowicz, the <see cref="CityHash"/> of the body's name
    /// from 2026110907-Lie, told apart by the parameter's own type, as the Uplink does.
    /// </summary>
    internal static class ProbeBodyKey
    {
        public static object For(MethodInfo call, int position, int index, string name) =>
            call.GetParameters()[position].ParameterType == typeof(ulong)
                ? CityHash.Hash64(name)
                : (object)index;
    }
}
