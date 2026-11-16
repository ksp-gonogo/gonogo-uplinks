// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System.Collections.Generic;
using kOS.Safe.Encapsulation;
using kOS.Safe.Exceptions;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Turns the lexicon a script hands to <c>ADDONS:GONOGO:RETURN</c> into the
    /// field map a <c>kos.run</c> result carries: each key as its text, each
    /// number, boolean or string as itself, and any other kOS value as the text
    /// kOS prints for it.
    /// </summary>
    public static class KosReturnFields
    {
        /// <summary>
        /// The field map for <paramref name="value"/>. Throws a kOS error, which
        /// stops the script and ends its run with that message, when the value
        /// is not a lexicon.
        /// </summary>
        public static Dictionary<string, object?> From(object? value)
        {
            if (!(value is Lexicon lexicon))
            {
                throw new KOSException("ADDONS:GONOGO:RETURN takes a LEXICON");
            }
            var fields = new Dictionary<string, object?>(lexicon.Count);
            foreach (var entry in lexicon)
            {
                fields[KeyText(entry.Key)] = Value(entry.Value);
            }
            return fields;
        }

        private static string KeyText(Structure key) => key is StringValue s ? s.ToString() : key.ToString();

        private static object? Value(Structure? value)
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
                default:
                    return value.ToString();
            }
        }
    }
}
