#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif
using Sitrep.Contract;

namespace Gonogo.KosUplink;

/// <summary>
/// Args for the <c>kos.files.list</c> command: asks for the files on one of a
/// CPU's volumes, read straight from the CPU's own volumes without typing
/// anything into its terminal. The answer arrives on the
/// <c>kos.run.&lt;coreId&gt;</c> channel as a <see cref="KosRunResult"/> whose
/// <see cref="KosRunResult.RequestId"/> echoes <see cref="RequestId"/>, with the
/// fields <c>op</c> (<c>list</c>), <c>path</c> (the volume asked for) and
/// <c>listing</c> (a JSON array of <c>{ name, size, isDir }</c>, where
/// <c>size</c> and <c>isDir</c> are <c>null</c> when the volume did not say).
/// Used by a script terminal's script picker.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kos.files.list")]
public class KosFilesListArgs
{
    /// <summary>Target CPU, identified by its <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>Caller-generated correlation token, echoed on the matching <see cref="KosRunResult"/>.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>The volume to list: <c>0:</c> for the Archive, <c>1:</c> for the CPU's own drive.</summary>
    [SitrepUnit(Units.Text)]
    public string Volume { get; set; } = "";
}

/// <summary>
/// Args for the <c>kos.files.read</c> command: asks for the text of one file on
/// one of a CPU's volumes, read through kOS's own volume objects without typing
/// anything into its terminal. The answer arrives on the
/// <c>kos.run.&lt;coreId&gt;</c> channel as a <see cref="KosRunResult"/> whose
/// <see cref="KosRunResult.RequestId"/> echoes <see cref="RequestId"/>, with the
/// fields <c>op</c> (<c>read</c>), <c>volume</c>, <c>path</c>, <c>text</c> (the
/// file's UTF-8 text, line endings as <c>\n</c>), <c>hash</c> (the file's content
/// hash, the value <see cref="KosFilesWriteArgs.ExpectedHash"/> takes) and
/// <c>size</c> (in bytes).
///
/// <para>A file name is accepted only inside the volume named: a path relative to
/// the volume's root, segments of letters, digits, <c>_</c>, <c>-</c> and
/// <c>.</c>, never <c>..</c>, ending in <c>.ks</c>, <c>.ksm</c>, <c>.txt</c> or
/// <c>.json</c>. A compiled <c>.ksm</c> file is binary and is refused, as is any
/// file that is not UTF-8 text or is larger than the size cap. The Archive is
/// refused when the craft has no link home, as <see cref="KosFilesListArgs"/> is.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kos.files.read")]
public class KosFilesReadArgs
{
    /// <summary>Target CPU, identified by its <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>Caller-generated correlation token, echoed on the matching <see cref="KosRunResult"/>.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>The volume the file is on: <c>0:</c> for the Archive, <c>1:</c> for the CPU's own drive.</summary>
    [SitrepUnit(Units.Text)]
    public string Volume { get; set; } = "";

    /// <summary>The file's path inside the volume, such as <c>lib/launch.ks</c>.</summary>
    [SitrepUnit(Units.Text)]
    public string Path { get; set; } = "";
}

/// <summary>
/// Args for the <c>kos.files.write</c> command: saves text as one file on one of
/// a CPU's volumes, through kOS's own volume objects. It is compare-and-set: the
/// write is refused, and nothing is written, when the file's content hash is no
/// longer <see cref="ExpectedHash"/>, so a file changed by another screen, the
/// in-game editor, a running script or a text editor since it was read is never
/// overwritten. On success the answer arrives on <c>kos.run.&lt;coreId&gt;</c>
/// with the fields <c>op</c> (<c>write</c>), <c>volume</c>, <c>path</c>,
/// <c>hash</c> (the hash of what was written) and <c>size</c>.
///
/// <para>The path rules and size cap are those of <see cref="KosFilesReadArgs"/>;
/// a <c>.ksm</c> file cannot be written as text. A write that does not fit on
/// the CPU's own drive is refused.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kos.files.write")]
public class KosFilesWriteArgs
{
    /// <summary>Target CPU, identified by its <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>Caller-generated correlation token, echoed on the matching <see cref="KosRunResult"/>.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>The volume the file is on: <c>0:</c> for the Archive, <c>1:</c> for the CPU's own drive.</summary>
    [SitrepUnit(Units.Text)]
    public string Volume { get; set; } = "";

    /// <summary>The file's path inside the volume, such as <c>lib/launch.ks</c>.</summary>
    [SitrepUnit(Units.Text)]
    public string Path { get; set; } = "";

    /// <summary>The file's new text. A <c>\r\n</c> line ending is saved as <c>\n</c>.</summary>
    [SitrepUnit(Units.Text)]
    public string Text { get; set; } = "";

    /// <summary>
    /// The <c>hash</c> the last read of this file answered with, or null to
    /// create a file, which is then refused if one already has that name.
    /// </summary>
    [SitrepUnit(Units.Id)]
    public string? ExpectedHash { get; set; }
}

/// <summary>
/// Args for the <c>kos.files.delete</c> command: deletes one file on one of a
/// CPU's volumes, compare-and-set like <see cref="KosFilesWriteArgs"/>, so it is
/// refused when the file has changed since it was read. On success the answer
/// arrives on <c>kos.run.&lt;coreId&gt;</c> with the fields <c>op</c>
/// (<c>delete</c>), <c>volume</c> and <c>path</c>. The path rules are those of
/// <see cref="KosFilesReadArgs"/>.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kos.files.delete")]
public class KosFilesDeleteArgs
{
    /// <summary>Target CPU, identified by its <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>Caller-generated correlation token, echoed on the matching <see cref="KosRunResult"/>.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>The volume the file is on: <c>0:</c> for the Archive, <c>1:</c> for the CPU's own drive.</summary>
    [SitrepUnit(Units.Text)]
    public string Volume { get; set; } = "";

    /// <summary>The file's path inside the volume, such as <c>lib/launch.ks</c>.</summary>
    [SitrepUnit(Units.Text)]
    public string Path { get; set; } = "";

    /// <summary>The <c>hash</c> the last read of this file answered with. Required.</summary>
    [SitrepUnit(Units.Id)]
    public string ExpectedHash { get; set; } = "";
}

/// <summary>
/// Args for the <c>kos.files.rename</c> command: renames or moves one file
/// within one of a CPU's volumes, compare-and-set like
/// <see cref="KosFilesWriteArgs"/>, so it is refused when the file has changed
/// since it was read, and refused when a file already has the new name. On
/// success the answer arrives on <c>kos.run.&lt;coreId&gt;</c> with the fields
/// <c>op</c> (<c>rename</c>), <c>volume</c>, <c>path</c> (the old path),
/// <c>newPath</c> and <c>hash</c>. Both paths follow the rules of
/// <see cref="KosFilesReadArgs"/>.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kos.files.rename")]
public class KosFilesRenameArgs
{
    /// <summary>Target CPU, identified by its <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>Caller-generated correlation token, echoed on the matching <see cref="KosRunResult"/>.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>The volume both paths are on: <c>0:</c> for the Archive, <c>1:</c> for the CPU's own drive.</summary>
    [SitrepUnit(Units.Text)]
    public string Volume { get; set; } = "";

    /// <summary>The file's current path inside the volume.</summary>
    [SitrepUnit(Units.Text)]
    public string Path { get; set; } = "";

    /// <summary>The path the file moves to, inside the same volume.</summary>
    [SitrepUnit(Units.Text)]
    public string NewPath { get; set; } = "";

    /// <summary>The <c>hash</c> the last read of this file answered with. Required.</summary>
    [SitrepUnit(Units.Id)]
    public string ExpectedHash { get; set; } = "";
}
