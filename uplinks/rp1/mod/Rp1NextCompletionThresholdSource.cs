using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// The next project RP-1 will finish as a Topic a SCET alarm can follow, so
    /// the warp stops on the tick it completes.
    ///
    /// <para><b>Why an alarm follows it and nothing else does.</b> The instant is
    /// RP-1's own answer to which project finishes first, recomputed every tick,
    /// and it moves: a shorter project overtaking the one being waited for brings
    /// it earlier, and a slower rate pushes it later. An alarm fixed at an instant
    /// would stop at the old one, and a client re-arming it would only do so
    /// while a screen was open. The simulation reads this builder on every tick
    /// the alarm is armed, so the alarm re-aims by itself.</para>
    ///
    /// <para><b>Read live, not from the last publish.</b> The builder is called
    /// in the tick the alarm is decided in and takes the reading itself, so an
    /// answer is never a figure from an earlier tick presented as current.</para>
    /// </summary>
    internal sealed class Rp1NextCompletionThresholdSource : IScetThresholdSources
    {
        /// <summary>The Topic <c>rp1.nextCompletion</c> publishes, so an alarm addresses what the operator can read.</summary>
        internal const string Topic = "rp1.nextCompletion";

        private readonly Func<KspSnapshot?, Rp1NextCompletionRaw?> _read;

        internal Rp1NextCompletionThresholdSource(Func<KspSnapshot?, Rp1NextCompletionRaw?> read) =>
            _read = read ?? throw new ArgumentNullException(nameof(read));

        public string ProviderId => "rp1-next-completion";

        public IReadOnlyList<ScetThresholdSource> Sources() => new[]
        {
            new ScetThresholdSource { Topic = Topic, Build = Build },
        };

        /// <summary>
        /// The wire shape plus the provenance stamp a reading is accepted on.
        /// Null whenever RP-1 would not answer, which reads as not now and never
        /// fires. The subject is <c>"game"</c>: the project queue belongs to the
        /// save rather than to anything flying.
        /// </summary>
        private object? Build(KspSnapshot? snapshot)
        {
            Rp1NextCompletionRaw? next;
            try
            {
                next = _read(snapshot);
            }
            catch (Exception)
            {
                // A reflection walk over a game this Uplink does not control: a
                // shape RP-1 changed is a tick without a reading, not an
                // exception that takes the whole alarm capture down.
                return null;
            }

            if (next == null)
            {
                return null;
            }

            return new Dictionary<string, object?>
            {
                ["ut"] = next.Ut,
                ["kind"] = next.Kind,
                ["label"] = next.Label,
                ["meta"] = new Dictionary<string, object?>
                {
                    ["source"] = "game",
                },
            };
        }
    }
}
