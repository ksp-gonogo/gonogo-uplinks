using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// The <c>BindAddress</c> Kerbcast's signalling endpoint listens on, read from
    /// the two settings files Kerbcast layers: its shipped defaults, then the
    /// player's override, which wins key by key. Only the override is ever
    /// written, a line at a time, so every other setting and comment in it stays
    /// as it was.
    ///
    /// <para>KSP-free: both files are reached through the paths handed in.</para>
    /// </summary>
    public sealed class KerbcastBindAddress
    {
        /// <summary>Kerbcast's own default: this computer only.</summary>
        public const string Loopback = "127.0.0.1";

        /// <summary>Every address of this computer, which is where Gonogo's own stream listens.</summary>
        public const string EveryAddress = "0.0.0.0";

        private static readonly Regex BindLine = new Regex(
            @"^(?<head>\s*BindAddress\s*=\s*)(?<value>[^\s/]*)(?<tail>.*)$", RegexOptions.Compiled);

        private readonly string _shippedPath;
        private readonly string _overridePath;

        /// <param name="shippedPath">Kerbcast's <c>settings.cfg</c>, which its release replaces on every update.</param>
        /// <param name="overridePath">Kerbcast's <c>PluginData/settings.cfg</c>, which need not exist yet.</param>
        public KerbcastBindAddress(string shippedPath, string overridePath)
        {
            _shippedPath = shippedPath;
            _overridePath = overridePath;
        }

        /// <summary>
        /// The address Kerbcast will bind at its next start, or <c>null</c> when a
        /// file cannot be read. Neither file naming one gives Kerbcast's default,
        /// <see cref="Loopback"/>.
        /// </summary>
        public string? Effective()
        {
            try
            {
                return Named(_overridePath) ?? Named(_shippedPath) ?? Loopback;
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
                return null;
            }
        }

        /// <summary>Whether Kerbcast will listen on every address, as Gonogo does, or <c>null</c> when a file cannot be read.</summary>
        public bool? FollowsGonogo()
        {
            var address = Effective();
            return address == null ? null : address == EveryAddress;
        }

        /// <summary>
        /// Writes <see cref="EveryAddress"/> (<paramref name="follow"/>) or
        /// <see cref="Loopback"/> into the override, unless Kerbcast already
        /// resolves to it. Null when nothing needed writing, otherwise why the
        /// write failed or an empty string when it landed.
        /// </summary>
        public string? Apply(bool follow)
        {
            try
            {
                var current = Effective();
                if (current == null)
                {
                    return "Kerbcast's settings could not be read";
                }

                if ((current == EveryAddress) == follow)
                {
                    return null;
                }

                var address = follow ? EveryAddress : Loopback;
                var lines = File.Exists(_overridePath) ? new List<string>(File.ReadAllLines(_overridePath)) : new List<string>();
                if (!Replace(lines, address))
                {
                    Insert(lines, address);
                }

                Directory.CreateDirectory(Path.GetDirectoryName(_overridePath)!);
                File.WriteAllText(_overridePath, string.Join(Environment.NewLine, lines) + Environment.NewLine, new UTF8Encoding(false));
                return string.Empty;
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
                return e.Message;
            }
        }

        private static string? Named(string path)
        {
            if (!File.Exists(path))
            {
                return null;
            }

            foreach (var line in File.ReadAllLines(path))
            {
                var match = BindLine.Match(line);
                if (match.Success)
                {
                    return match.Groups["value"].Value;
                }
            }

            return null;
        }

        private static bool Replace(List<string> lines, string address)
        {
            for (var i = 0; i < lines.Count; i++)
            {
                var match = BindLine.Match(lines[i]);
                if (match.Success)
                {
                    lines[i] = match.Groups["head"].Value + address + match.Groups["tail"].Value;
                    return true;
                }
            }

            return false;
        }

        private static void Insert(List<string> lines, string address)
        {
            var entry = "  BindAddress = " + address;
            for (var i = 0; i + 1 < lines.Count; i++)
            {
                if (lines[i].Trim() == "Settings" && lines[i + 1].Trim() == "{")
                {
                    lines.Insert(i + 2, entry);
                    return;
                }
            }

            lines.AddRange(new[] { "Settings", "{", entry, "}" });
        }
    }
}
