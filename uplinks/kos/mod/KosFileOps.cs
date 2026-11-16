// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using kOS.Safe;
using kOS.Safe.Exceptions;
using kOS.Safe.Persistence;
using Sitrep.Contract;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// What a file command came to: a refusal, the fields to answer with, or an
    /// error kOS raised while it ran. Exactly one is set.
    /// </summary>
    public sealed class KosFileOutcome
    {
        private KosFileOutcome(CommandResult? refusal, Dictionary<string, object?>? fields, string? error)
        {
            Refusal = refusal;
            Fields = fields;
            Error = error;
        }

        public CommandResult? Refusal { get; }
        public Dictionary<string, object?>? Fields { get; }
        public string? Error { get; }

        public static KosFileOutcome Refused(CommandResult refusal) => new KosFileOutcome(refusal, null, null);
        public static KosFileOutcome Answered(Dictionary<string, object?> fields) => new KosFileOutcome(null, fields, null);
        public static KosFileOutcome Failed(string error) => new KosFileOutcome(null, null, error);
    }

    /// <summary>
    /// The <c>kos.files.read</c>, <c>write</c>, <c>delete</c> and <c>rename</c>
    /// commands applied to one kOS volume, through kOS's own <see cref="Volume"/>
    /// API so its cache, name rules and drive capacity hold, never through file
    /// I/O of this mod's own.
    ///
    /// <para>Each call reads the file's current hash and acts on it in the same
    /// call, and runs on KSP's main thread, where every kOS writer (a script's
    /// <c>LOG</c>, the in-game editor, another command) also runs, so nothing in
    /// the game can change the file between the compare and the set.</para>
    /// </summary>
    public static class KosFileOps
    {
        public static KosFileOutcome Read(Volume volume, string volumeName, string path)
        {
            var refusal = KosFileRules.PathRefusal(path);
            if (refusal != null)
            {
                return KosFileOutcome.Refused(refusal);
            }
            try
            {
                var current = Current(volume, path, out var bytes);
                if (current != null)
                {
                    return KosFileOutcome.Refused(current);
                }
                if (bytes == null)
                {
                    return KosFileOutcome.Refused(CommandResult.Fail(KosErrorCodes.FileNotFound));
                }
                var notText = KosFileRules.TextOf(bytes, out var text);
                return notText != null
                    ? KosFileOutcome.Refused(notText)
                    : KosFileOutcome.Answered(KosFileRules.ReadFields(volumeName, path, text, KosFileRules.Hash(bytes), bytes.Length));
            }
            catch (Exception e) when (IsFileError(e))
            {
                return Failed(volumeName, path, e);
            }
        }

        public static KosFileOutcome Write(Volume volume, string volumeName, string path, string? text, string? expectedHash)
        {
            var bytes = Array.Empty<byte>();
            var refusal = KosFileRules.PathRefusal(path);
            if (refusal == null)
            {
                refusal = KosFileRules.BytesOf(text, out bytes);
            }
            if (refusal != null)
            {
                return KosFileOutcome.Refused(refusal);
            }
            try
            {
                var current = Current(volume, path, out var existing);
                var refused = current
                    ?? KosFileRules.CompareRefusal(expectedHash, existing == null ? null : KosFileRules.Hash(existing), mayCreate: true);
                if (refused != null)
                {
                    return KosFileOutcome.Refused(refused);
                }
                var volumePath = VolumePath.FromString(path);
                var content = new FileContent(bytes);
                if (!volume.IsRoomFor(volumePath, content))
                {
                    return KosFileOutcome.Refused(KosFileRules.DriveFull(bytes.Length, volume.FreeSpace + (existing?.Length ?? 0)));
                }
                var saved = volume.SaveFile(volumePath, content);
                if (saved == null)
                {
                    return KosFileOutcome.Refused(KosFileRules.DriveFull(bytes.Length, volume.FreeSpace + (existing?.Length ?? 0)));
                }
                var written = saved.ReadAll().Bytes;
                return KosFileOutcome.Answered(KosFileRules.WriteFields(volumeName, path, KosFileRules.Hash(written), written.Length));
            }
            catch (Exception e) when (IsFileError(e))
            {
                return Failed(volumeName, path, e);
            }
        }

        public static KosFileOutcome Delete(Volume volume, string volumeName, string path, string? expectedHash)
        {
            var refusal = KosFileRules.PathRefusal(path) ?? Required(expectedHash);
            if (refusal != null)
            {
                return KosFileOutcome.Refused(refusal);
            }
            try
            {
                var current = Current(volume, path, out var existing);
                var refused = current
                    ?? KosFileRules.CompareRefusal(expectedHash, existing == null ? null : KosFileRules.Hash(existing), mayCreate: false);
                if (refused != null)
                {
                    return KosFileOutcome.Refused(refused);
                }
                return volume.Delete(VolumePath.FromString(path))
                    ? KosFileOutcome.Answered(KosFileRules.DeleteFields(volumeName, path))
                    : KosFileOutcome.Failed("kOS did not delete " + volumeName + path);
            }
            catch (Exception e) when (IsFileError(e))
            {
                return Failed(volumeName, path, e);
            }
        }

        /// <summary>
        /// Moves the file by deleting it and saving its bytes under the new name,
        /// putting it back if the save fails, so a rename that fails leaves the
        /// file where it was. Deleting first means a full CPU drive never refuses
        /// a rename, which needs no more room than the file already takes.
        /// </summary>
        public static KosFileOutcome Rename(Volume volume, string volumeName, string path, string? newPath, string? expectedHash)
        {
            var refusal = KosFileRules.PathRefusal(path) ?? KosFileRules.RenameRefusal(path, newPath) ?? Required(expectedHash);
            if (refusal != null)
            {
                return KosFileOutcome.Refused(refusal);
            }
            try
            {
                var current = Current(volume, path, out var existing);
                var refused = current
                    ?? KosFileRules.CompareRefusal(expectedHash, existing == null ? null : KosFileRules.Hash(existing), mayCreate: false);
                if (refused != null)
                {
                    return KosFileOutcome.Refused(refused);
                }
                var target = VolumePath.FromString(newPath!);
                if (volume.Open(target) != null)
                {
                    return KosFileOutcome.Refused(CommandResult.Fail(KosErrorCodes.FileExists, "the new path is already taken"));
                }
                var source = VolumePath.FromString(path);
                var content = new FileContent(existing!);
                if (!volume.Delete(source))
                {
                    return KosFileOutcome.Failed("kOS did not move " + volumeName + path);
                }
                VolumeFile? saved = null;
                try
                {
                    saved = volume.SaveFile(target, content);
                }
                finally
                {
                    if (saved == null)
                    {
                        volume.SaveFile(source, content, false);
                    }
                }
                if (saved == null)
                {
                    return KosFileOutcome.Refused(KosFileRules.DriveFull(existing!.Length, volume.FreeSpace));
                }
                return KosFileOutcome.Answered(KosFileRules.RenameFields(volumeName, path, newPath!, KosFileRules.Hash(saved.ReadAll().Bytes)));
            }
            catch (Exception e) when (IsFileError(e))
            {
                return Failed(volumeName, path, e);
            }
        }

        /// <summary>
        /// The refusal for what is at <paramref name="path"/> now, or null with
        /// <paramref name="bytes"/> set to the file's bytes, or to null when no
        /// file is there.
        /// </summary>
        private static CommandResult? Current(Volume volume, string path, out byte[]? bytes)
        {
            bytes = null;
            var item = volume.Open(VolumePath.FromString(path));
            if (item is VolumeDirectory)
            {
                return CommandResult.Fail(KosErrorCodes.NotAFile);
            }
            if (item is VolumeFile file)
            {
                bytes = file.ReadAll().Bytes;
            }
            return null;
        }

        private static CommandResult? Required(string? expectedHash) =>
            string.IsNullOrEmpty(expectedHash) ? CommandResult.Fail(KosErrorCodes.HashRequired) : null;

        /*
         * No lambdas in this class: a lambda capturing a Volume becomes a
         * compiler-generated class with a kOS-typed field, which KSP cannot load
         * before kOS.
         */

        /// <summary>
        /// A kOS refusal of the path (such as a folder in the path that is a
        /// file) or a disk error under the Archive, answered as an error that
        /// names the file rather than thrown through the command handler.
        /// </summary>
        private static bool IsFileError(Exception e) =>
            e is KOSException
            || e is KOSPersistenceException
            || e is System.IO.IOException
            || e is UnauthorizedAccessException;

        private static KosFileOutcome Failed(string volumeName, string path, Exception e) =>
            KosFileOutcome.Failed("could not use " + volumeName + path + ": " + e.Message);
    }
}
