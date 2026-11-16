// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Sitrep.Contract;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// The rules the <c>kos.files.*</c> commands hold a path, a file's bytes and
    /// a compare-and-set to, and the fields each answers with. KSP-free, so every
    /// refusal is testable headlessly; <see cref="KosFileOps"/> applies them to a
    /// kOS volume.
    /// </summary>
    public static class KosFileRules
    {
        /// <summary>The largest file, in UTF-8 bytes, a file command reads or writes.</summary>
        public const int MaxFileBytes = 128 * 1024;

        /// <summary>The longest path, in characters, a file command accepts.</summary>
        public const int MaxPathLength = 200;

        /// <summary>The most segments, the file's own name included, a path may have.</summary>
        public const int MaxPathDepth = 8;

        /// <summary>The file name extensions a file command reaches, lower case.</summary>
        public static readonly IReadOnlyList<string> Extensions = new[] { "ks", "ksm", "txt", "json" };

        /// <summary>The volume names a file command takes: the Archive and the CPU's own drive.</summary>
        public static readonly IReadOnlyList<string> Volumes = new[] { KosFileListing.ArchiveVolume, "1:" };

        private static readonly UTF8Encoding StrictUtf8 = new UTF8Encoding(false, true);

        /// <summary>The refusal for a volume name that is neither the Archive nor the CPU's own drive, or null.</summary>
        public static CommandResult? VolumeRefusal(string? volume) =>
            volume != null && Volumes.Contains(volume)
                ? null
                : CommandResult.Fail(CommandErrorCode.NotFound, "the volume must be 0: (the Archive) or 1: (the CPU's own drive)");

        /// <summary>
        /// The refusal for <paramref name="path"/>, or null when a file command
        /// may use it. Checked before kOS sees the path, so nothing kOS would
        /// resolve outside the volume, or to a file of another kind, gets that far.
        /// </summary>
        public static CommandResult? PathRefusal(string? path)
        {
            if (string.IsNullOrEmpty(path))
            {
                return BadPath("the path is empty");
            }
            if (path!.Length > MaxPathLength)
            {
                return BadPath("the path is longer than " + MaxPathLength.ToString(CultureInfo.InvariantCulture) + " characters");
            }
            if (path[0] == '/' || path.IndexOf(':') >= 0)
            {
                return BadPath("the path must be relative to the volume's root, with no volume or leading /");
            }
            var segments = path.Split('/');
            if (segments.Length > MaxPathDepth)
            {
                return BadPath("the path is more than " + MaxPathDepth.ToString(CultureInfo.InvariantCulture) + " folders deep");
            }
            foreach (var segment in segments)
            {
                if (segment.Length == 0)
                {
                    return BadPath("the path has an empty segment");
                }
                if (segment == "." || segment == "..")
                {
                    return BadPath("the path may not use . or ..");
                }
                if (segment[0] == '.')
                {
                    return BadPath("a name may not start with .");
                }
                foreach (var c in segment)
                {
                    if (!IsNameChar(c))
                    {
                        return BadPath("a name may use only letters, digits, _, - and .");
                    }
                }
            }
            var extension = Extension(path);
            if (!Extensions.Contains(extension))
            {
                return CommandResult.Fail(KosErrorCodes.FileType, "the file must end in .ks, .ksm, .txt or .json");
            }
            if (extension == "ksm")
            {
                return CommandResult.Fail(KosErrorCodes.NotText, "a compiled .ksm file is binary and cannot be read or written as text");
            }
            return null;
        }

        /// <summary>The refusal for <paramref name="newPath"/> as the target of renaming <paramref name="path"/>, or null.</summary>
        public static CommandResult? RenameRefusal(string path, string? newPath)
        {
            var refusal = PathRefusal(newPath);
            if (refusal != null)
            {
                return refusal;
            }
            return string.Equals(path, newPath, StringComparison.OrdinalIgnoreCase)
                ? BadPath("the new path is the same file as the old one")
                : null;
        }

        /// <summary>
        /// The file's text, or the refusal to answer a read with: a file larger
        /// than <see cref="MaxFileBytes"/>, or one that is not UTF-8 text.
        /// </summary>
        public static CommandResult? TextOf(byte[] bytes, out string text)
        {
            text = "";
            if (bytes.Length > MaxFileBytes)
            {
                return TooLarge(bytes.Length);
            }
            if (Array.IndexOf(bytes, (byte)0) >= 0)
            {
                return NotText();
            }
            try
            {
                text = StrictUtf8.GetString(bytes);
            }
            catch (ArgumentException)
            {
                return NotText();
            }
            return null;
        }

        /// <summary>
        /// The bytes a write saves for <paramref name="text"/>, with <c>\r\n</c>
        /// saved as <c>\n</c>, or the refusal for text larger than
        /// <see cref="MaxFileBytes"/> or carrying a NUL.
        /// </summary>
        public static CommandResult? BytesOf(string? text, out byte[] bytes)
        {
            var normalised = (text ?? "").Replace("\r\n", "\n");
            bytes = StrictUtf8.GetBytes(normalised);
            if (bytes.Length > MaxFileBytes)
            {
                return TooLarge(bytes.Length);
            }
            return normalised.IndexOf('\0') >= 0 ? NotText() : null;
        }

        /// <summary>The content hash of a file's bytes: lower-case hex SHA-256.</summary>
        public static string Hash(byte[] bytes)
        {
            using (var sha = SHA256.Create())
            {
                var digest = sha.ComputeHash(bytes);
                var sb = new StringBuilder(digest.Length * 2);
                foreach (var b in digest)
                {
                    sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
                }
                return sb.ToString();
            }
        }

        /// <summary>
        /// The compare-and-set refusal, or null when the command may go ahead.
        /// <paramref name="currentHash"/> is null when no file is at the path.
        /// A null or empty <paramref name="expectedHash"/> asks for a new file,
        /// which only a <paramref name="mayCreate"/> command may do.
        /// </summary>
        public static CommandResult? CompareRefusal(string? expectedHash, string? currentHash, bool mayCreate)
        {
            if (string.IsNullOrEmpty(expectedHash))
            {
                if (!mayCreate)
                {
                    return CommandResult.Fail(KosErrorCodes.HashRequired);
                }
                return currentHash == null
                    ? null
                    : CommandResult.Fail(KosErrorCodes.FileExists, "read the file before saving over it");
            }
            if (currentHash == null)
            {
                return CommandResult.Fail(KosErrorCodes.FileChanged, "the file is no longer there");
            }
            return string.Equals(expectedHash, currentHash, StringComparison.OrdinalIgnoreCase)
                ? null
                : CommandResult.Fail(KosErrorCodes.FileChanged, "read the file again before saving over it");
        }

        /// <summary>The refusal for a write the CPU's drive has no room for.</summary>
        public static CommandResult DriveFull(long needed, long free) =>
            CommandResult.Fail(
                KosErrorCodes.DriveFull,
                "the file needs " + needed.ToString(CultureInfo.InvariantCulture) + " bytes and the drive has "
                    + Math.Max(0, free).ToString(CultureInfo.InvariantCulture) + " free");

        public static Dictionary<string, object?> ReadFields(string volume, string path, string text, string hash, int size) =>
            new Dictionary<string, object?>
            {
                ["op"] = "read",
                ["volume"] = volume,
                ["path"] = path,
                ["text"] = text,
                ["hash"] = hash,
                ["size"] = size,
            };

        public static Dictionary<string, object?> WriteFields(string volume, string path, string hash, int size) =>
            new Dictionary<string, object?>
            {
                ["op"] = "write",
                ["volume"] = volume,
                ["path"] = path,
                ["hash"] = hash,
                ["size"] = size,
            };

        public static Dictionary<string, object?> DeleteFields(string volume, string path) =>
            new Dictionary<string, object?>
            {
                ["op"] = "delete",
                ["volume"] = volume,
                ["path"] = path,
            };

        public static Dictionary<string, object?> RenameFields(string volume, string path, string newPath, string hash) =>
            new Dictionary<string, object?>
            {
                ["op"] = "rename",
                ["volume"] = volume,
                ["path"] = path,
                ["newPath"] = newPath,
                ["hash"] = hash,
            };

        private static bool IsNameChar(char c) =>
            (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-' || c == '.';

        private static string Extension(string path)
        {
            var name = path.Substring(path.LastIndexOf('/') + 1);
            var dot = name.LastIndexOf('.');
            return dot < 0 ? "" : name.Substring(dot + 1).ToLowerInvariant();
        }

        private static CommandResult BadPath(string detail) => CommandResult.Fail(KosErrorCodes.BadPath, detail);

        private static CommandResult NotText() => CommandResult.Fail(KosErrorCodes.NotText, "the file is not UTF-8 text");

        private static CommandResult TooLarge(int size) =>
            CommandResult.Fail(
                KosErrorCodes.FileTooLarge,
                "the file is " + size.ToString(CultureInfo.InvariantCulture) + " bytes and the most a file command carries is "
                    + MaxFileBytes.ToString(CultureInfo.InvariantCulture));
    }
}
