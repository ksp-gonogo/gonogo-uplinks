// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System.Collections.Generic;
using kOS.Safe.Encapsulation;
using kOS.Suffixed;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Turns the value a script hands to <c>ADDONS:GONOGO:RETURN</c> into the
    /// field map a <c>kos.run</c> result carries. A lexicon's keys become the
    /// fields; any other value arrives as the single field <c>value</c>. Each
    /// field holds a number, boolean or string as itself, and every other kOS
    /// value as the <see cref="KosReturnShapes"/> shape for its type.
    /// </summary>
    public static class KosReturnFields
    {
        /// <summary>Nesting beyond this depth, which also stops a lexicon that holds itself, arrives as text.</summary>
        public const int MaxDepth = 8;

        /// <summary>Items kept from one collection; the count cut off is carried beside it.</summary>
        public const int MaxItems = 500;

        /// <summary>
        /// Names the part or vessel a value refers to, or returns null when the
        /// value is neither. Installed by the plugin, because reading a part
        /// or vessel needs the game's own assemblies.
        /// </summary>
        public static System.Func<object, Dictionary<string, object?>?>? ReferenceReader { get; set; }

        /// <summary>The field map for <paramref name="value"/>.</summary>
        public static Dictionary<string, object?> From(object? value)
        {
            var fields = new Dictionary<string, object?>();
            if (value is Lexicon lexicon)
            {
                foreach (var entry in lexicon)
                {
                    fields[KeyText(entry.Key)] = Convert(entry.Value, 1);
                }
                return fields;
            }
            fields["value"] = Convert(value as Structure, 1);
            return fields;
        }

        /// <summary>The wire value for any value a script hands to LOG: its own shape, never wrapped under a field name.</summary>
        public static object? ValueOf(object? value) => Convert(value as Structure, 1);

        private static string KeyText(Structure key) => key is StringValue s ? s.ToString() : key.ToString();

        private static string TypeName(Structure value)
        {
            try
            {
                return value.KOSName;
            }
            catch (System.Exception)
            {
                return value.GetType().Name;
            }
        }

        /// <summary>The wire value for <paramref name="value"/> at nesting <paramref name="depth"/>.</summary>
        internal static object? Convert(Structure? value, int depth)
        {
            switch (value)
            {
                case null:
                    return null;
                case ScalarValue scalar:
                    return scalar.GetDoubleValue();
                case BooleanValue boolean:
                    return boolean.Value;
                case StringValue text:
                    return text.ToString();
            }
            if (depth > MaxDepth)
            {
                return KosReturnShapes.Other(TypeName(value), CappedText(value));
            }
            switch (value)
            {
                case Lexicon lexicon:
                    return ConvertLexicon(lexicon, depth);
                case Vector vector:
                    return KosReturnShapes.Vector(vector.X, vector.Y, vector.Z);
                case Direction direction:
                    return ConvertDirection(direction);
                case TimeSpan span:
                    return KosReturnShapes.TimeSpan(span.ToUnixStyleTime());
                case TimeStamp stamp:
                    return KosReturnShapes.TimeStamp(stamp.ToUnixStyleTime());
                case GeoCoordinates geo:
                    return KosReturnShapes.Geo(geo.Latitude, geo.Longitude);
                case IEnumerable<Structure> items:
                    return ConvertList(TypeName(value), items, depth);
            }
            return ReferenceReader?.Invoke(value) ?? KosReturnShapes.Other(TypeName(value), value.ToString());
        }

        /*
         * A collection's own text prints its contents, which never ends for one
         * that holds itself, so a collection past the depth limit is described by
         * its size instead.
         */
        private static string CappedText(Structure value)
        {
            switch (value)
            {
                case Lexicon lexicon:
                    return TypeName(value) + " of " + lexicon.Count + " items";
                case IEnumerable<Structure> items:
                    var count = 0;
                    foreach (var _ in items)
                    {
                        count++;
                    }
                    return TypeName(value) + " of " + count + " items";
                default:
                    return value.ToString();
            }
        }

        private static object ConvertLexicon(Lexicon lexicon, int depth)
        {
            var entries = new List<object?>();
            var omitted = 0;
            foreach (var entry in lexicon)
            {
                if (entries.Count >= MaxItems)
                {
                    omitted++;
                    continue;
                }
                entries.Add(KosReturnShapes.Entry(KeyText(entry.Key), Convert(entry.Value, depth + 1)));
            }
            return KosReturnShapes.Lexicon(entries, omitted);
        }

        private static object ConvertList(string type, IEnumerable<Structure> items, int depth)
        {
            var kept = new List<object?>();
            var omitted = 0;
            foreach (var item in items)
            {
                if (kept.Count >= MaxItems)
                {
                    omitted++;
                    continue;
                }
                kept.Add(Convert(item, depth + 1));
            }
            return KosReturnShapes.List(type, kept, omitted);
        }

        private static object ConvertDirection(Direction direction)
        {
            var q = direction.Rotation;
            var euler = KosQuaternion.ToEulerDegrees(q.x, q.y, q.z, q.w);
            return KosReturnShapes.Direction(euler.pitch, euler.yaw, euler.roll);
        }
    }
}
