using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Gonogo.UplinkWiring
{
    /// <summary>
    /// Where this repo's Uplinks are on disk, and what their own
    /// <c>uplink.json</c> says they are.
    ///
    /// <para>The layout half of the wiring walk, and the only part of it that is
    /// written here: <see cref="UplinkWiringScan"/> is vendored verbatim from
    /// <c>gonogo</c> (see <c>UPSTREAM.json</c>) so the two repos run ONE walk
    /// rather than two that agree until one of them stops matching. An Uplink is
    /// laid out <c>uplinks/&lt;name&gt;/mod</c> + <c>mod-contract</c> here and
    /// <c>mod/Gonogo&lt;X&gt;Uplink</c> + <c>.Contract</c> there, which is the
    /// whole of the difference.</para>
    ///
    /// <para><b>Enrolment is by EXISTING, never by being listed.</b> An Uplink
    /// gets this check by having a <c>mod/</c> with a csproj in it. The guard this
    /// replaces for departed Uplinks was a per-project one, and the per-project
    /// form is the thing that gets forgotten: the Uplinks with the largest command
    /// surfaces were the ones nobody had added it to.</para>
    /// </summary>
    internal static class UplinkSources
    {
        /// <summary>
        /// Uplink directory name -&gt; the directories holding its C#. Present
        /// directories only; an Uplink with no contract slice is normal.
        /// </summary>
        public static Dictionary<string, IReadOnlyList<string>> Discover()
        {
            var uplinks = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);

            foreach (var directory in Directory.EnumerateDirectories(UplinksDir()))
            {
                var mod = Path.Combine(directory, "mod");
                if (!Directory.Exists(mod) || !Directory.EnumerateFiles(mod, "*.csproj").Any())
                {
                    continue;
                }

                uplinks[Path.GetFileName(directory)] = new[] { mod, Path.Combine(directory, "mod-contract") }
                    .Where(Directory.Exists)
                    .ToList();
            }

            return uplinks;
        }

        /// <summary>
        /// The Uplinks that declare themselves through an <c>uplink.json</c>: the
        /// independent source the directory walk is checked against, the same way
        /// <c>gonogo</c> checks its walk against <c>Gonogo.sln</c>. A floor alone
        /// cannot tell a broken walk from a shrinking repo, and this repo's CI
        /// matrix is built from these same files, so a walk that disagrees with
        /// them is looking somewhere CI is not.
        /// </summary>
        public static HashSet<string> DeclaredInManifests() =>
            Directory.EnumerateDirectories(UplinksDir())
                .Where(d => File.Exists(Path.Combine(d, "uplink.json")))
                .Select(Path.GetFileName)
                .Where(name => name is not null)
                .Select(name => name!)
                .ToHashSet(StringComparer.Ordinal);

        /// <summary>
        /// <c>uplinks/</c>, found by walking up from the test binary rather than
        /// from a relative path, so the walk works the same from a CI runner, an
        /// IDE and <c>dotnet test</c> in any directory.
        /// </summary>
        public static string UplinksDir()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null)
            {
                var candidate = Path.Combine(directory.FullName, "uplinks");
                if (Directory.Exists(candidate) && File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
                {
                    return candidate;
                }

                directory = directory.Parent;
            }

            throw new InvalidOperationException(
                "Could not locate uplinks/ walking up from " + AppContext.BaseDirectory);
        }
    }
}
