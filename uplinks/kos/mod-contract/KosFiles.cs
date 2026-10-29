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
