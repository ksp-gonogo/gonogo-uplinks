using System;

namespace GonogoPrincipiaUplink
{
    /// <summary>One request/reply line channel to a worker.</summary>
    public interface IPrincipiaWorkerChannel : IDisposable
    {
        /// <summary>Send one request and return its reply line, or null if the
        /// worker stopped without one, or said nothing in time.</summary>
        string? Exchange(string request);
    }

    /// <summary>
    /// What is said to and read back from a private copy of Principia's build. See
    /// <see cref="PrincipiaPrivateCopy"/> for the copy itself.
    /// </summary>
    public static class PrincipiaWorkerProcess
    {
        /// <summary>
        /// Ask the worker for the CPU feature flags Principia's own loader
        /// dispatches on.
        ///
        /// <para>This is the first thing worth asking, and not a warm-up. The
        /// build's selection turns on the FMA bit, so anything deciding whether a
        /// worker reproduces the game's arithmetic needs that bit as the game host
        /// reports it. Read anywhere else it answers a different question in the
        /// shape of the right one, which is why it is asked here, in a process on
        /// the game's own machine, rather than wherever the asking code happens to
        /// be running.</para>
        ///
        /// <para>It is also the safest call on the whole surface: two out
        /// parameters, a CPUID read, no plugin, no save, no global state. It is
        /// answered from the copy the game already loaded, so it opens nothing.</para>
        /// </summary>
        public static PrincipiaHostFacts AskCpuidFeatureFlags(
            IPrincipiaWorkerChannel? channel, string? libraryPath, string osFamily)
        {
            if (channel == null || string.IsNullOrEmpty(libraryPath))
            {
                return new PrincipiaHostFacts(osFamily, null);
            }

            string? reply;
            try
            {
                reply = channel.Exchange("F\t" + libraryPath + "\n");
            }
            catch (Exception)
            {
                // A worker that died is not a CPU without FMA. Unknown is the only
                // honest answer, and it is the one that makes the decision above
                // refuse rather than proceed on a guess.
                return new PrincipiaHostFacts(osFamily, null);
            }

            var hasFma = BoolField(reply, "hasFma");
            var ok = BoolField(reply, "ok");
            return ok == true && hasFma != null
                ? new PrincipiaHostFacts(osFamily, hasFma)
                : new PrincipiaHostFacts(osFamily, null);
        }

        /// <summary>
        /// Read one string out of the worker's reply, or null when it is absent. Only
        /// for values the worker writes with no escapes in them, such as its numbers.
        /// </summary>
        internal static string? PlainStringField(string? json, string field)
        {
            if (string.IsNullOrEmpty(json))
            {
                return null;
            }
            var key = "\"" + field + "\": \"";
            var at = json!.IndexOf(key, StringComparison.Ordinal);
            if (at < 0)
            {
                return null;
            }
            var start = at + key.Length;
            var end = json.IndexOf('"', start);
            return end < 0 ? null : json.Substring(start, end - start);
        }

        /// <summary>Read one number out of the worker's reply, or null when it is absent.</summary>
        internal static double? NumberField(string? json, string field)
        {
            if (string.IsNullOrEmpty(json))
            {
                return null;
            }
            var key = "\"" + field + "\": ";
            var at = json!.IndexOf(key, StringComparison.Ordinal);
            if (at < 0)
            {
                return null;
            }
            var start = at + key.Length;
            var end = start;
            while (end < json.Length && json[end] != ',' && json[end] != '}')
            {
                end++;
            }
            return double.TryParse(
                json.Substring(start, end - start),
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var value)
                ? value
                : (double?)null;
        }

        /// <summary>
        /// Read one boolean out of the worker's reply.
        ///
        /// <para>Hand-parsed rather than deserialized because this Uplink may
        /// reference only the contract, and pulling in a JSON library to read two
        /// booleans would be a dependency taken for a handshake. Returns null for
        /// anything it cannot read, which the caller treats as unknown rather than
        /// as false: those are different facts and the second is a claim.</para>
        /// </summary>
        internal static bool? BoolField(string? json, string field)
        {
            if (string.IsNullOrEmpty(json))
            {
                return null;
            }
            var key = "\"" + field + "\"";
            var at = json!.IndexOf(key, StringComparison.Ordinal);
            if (at < 0)
            {
                return null;
            }
            var colon = json.IndexOf(':', at + key.Length);
            if (colon < 0)
            {
                return null;
            }
            var rest = json.Substring(colon + 1).TrimStart();
            if (rest.StartsWith("true", StringComparison.Ordinal))
            {
                return true;
            }
            return rest.StartsWith("false", StringComparison.Ordinal) ? (bool?)false : null;
        }
    }
}
