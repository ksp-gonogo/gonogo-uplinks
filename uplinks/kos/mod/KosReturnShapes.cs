// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System.Collections.Generic;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// The wire shape of each structured value a script can hand to
    /// <c>ADDONS:GONOGO:RETURN</c>. Every structured value is an object whose
    /// <c>kind</c> names the shape; numbers, booleans and strings travel bare.
    /// Free of kOS and Unity types so the shapes are testable on their own.
    /// </summary>
    public static class KosReturnShapes
    {
        public const string KindList = "list";
        public const string KindLexicon = "lexicon";
        public const string KindVector = "vector";
        public const string KindDirection = "direction";
        public const string KindTimeSpan = "timespan";
        public const string KindTimeStamp = "timestamp";
        public const string KindGeo = "geo";
        public const string KindPart = "part";
        public const string KindVessel = "vessel";
        public const string KindOther = "other";

        /// <summary>A collection's items in order; <paramref name="omitted"/> counts the items cut off the end.</summary>
        public static Dictionary<string, object?> List(string type, List<object?> items, int omitted) =>
            new Dictionary<string, object?>
            {
                ["kind"] = KindList,
                ["type"] = type,
                ["items"] = items,
                ["omitted"] = omitted,
            };

        /// <summary>A lexicon's entries in order, each as a key text and a value.</summary>
        public static Dictionary<string, object?> Lexicon(List<object?> entries, int omitted) =>
            new Dictionary<string, object?>
            {
                ["kind"] = KindLexicon,
                ["entries"] = entries,
                ["omitted"] = omitted,
            };

        public static Dictionary<string, object?> Entry(string key, object? value) =>
            new Dictionary<string, object?> { ["key"] = key, ["value"] = value };

        public static Dictionary<string, object?> Vector(double x, double y, double z) =>
            new Dictionary<string, object?>
            {
                ["kind"] = KindVector,
                ["x"] = x,
                ["y"] = y,
                ["z"] = z,
                ["magnitude"] = System.Math.Sqrt(x * x + y * y + z * z),
            };

        /// <summary>A direction as the pitch, yaw and roll in degrees kOS prints for it.</summary>
        public static Dictionary<string, object?> Direction(double pitch, double yaw, double roll) =>
            new Dictionary<string, object?>
            {
                ["kind"] = KindDirection,
                ["pitch"] = pitch,
                ["yaw"] = yaw,
                ["roll"] = roll,
            };

        public static Dictionary<string, object?> TimeSpan(double seconds) =>
            new Dictionary<string, object?> { ["kind"] = KindTimeSpan, ["seconds"] = seconds };

        public static Dictionary<string, object?> TimeStamp(double seconds) =>
            new Dictionary<string, object?> { ["kind"] = KindTimeStamp, ["seconds"] = seconds };

        public static Dictionary<string, object?> Geo(double latitude, double longitude) =>
            new Dictionary<string, object?>
            {
                ["kind"] = KindGeo,
                ["latitude"] = latitude,
                ["longitude"] = longitude,
            };

        public static Dictionary<string, object?> Part(string name, string id) =>
            new Dictionary<string, object?> { ["kind"] = KindPart, ["name"] = name, ["id"] = id };

        public static Dictionary<string, object?> Vessel(string name, string id) =>
            new Dictionary<string, object?> { ["kind"] = KindVessel, ["name"] = name, ["id"] = id };

        /// <summary>Any kOS value with no shape of its own: its kOS type name and the text kOS prints for it.</summary>
        public static Dictionary<string, object?> Other(string type, string text) =>
            new Dictionary<string, object?> { ["kind"] = KindOther, ["type"] = type, ["text"] = text };
    }
}
