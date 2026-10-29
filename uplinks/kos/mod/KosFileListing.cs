// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Gonogo.KosUplink
{
    /// <summary>One entry of a volume listing: a null size or kind is a volume that did not say.</summary>
    public readonly struct KosListedFile
    {
        public KosListedFile(string name, long? size, bool? isDirectory)
        {
            Name = name;
            Size = size;
            IsDirectory = isDirectory;
        }

        public string Name { get; }
        public long? Size { get; }
        public bool? IsDirectory { get; }
    }

    /// <summary>
    /// Builds the <c>kos.files.list</c> answer's fields, KSP-free so it is
    /// testable headlessly. The shape is the one the script picker has always
    /// read: <c>op</c>, <c>path</c> and a <c>listing</c> JSON array of
    /// <c>{ name, size, isDir }</c>, with <c>null</c> for a size or kind the
    /// volume did not report, never a substituted 0 or false.
    /// </summary>
    public static class KosFileListing
    {
        public static Dictionary<string, object?> Fields(string volume, IEnumerable<KosListedFile> files) =>
            new Dictionary<string, object?>
            {
                ["op"] = "list",
                ["path"] = volume,
                ["listing"] = Json(files),
            };

        public static string Json(IEnumerable<KosListedFile> files)
        {
            var sb = new StringBuilder("[");
            var first = true;
            foreach (var f in files)
            {
                if (!first)
                {
                    sb.Append(',');
                }
                first = false;
                sb.Append("{\"name\":");
                AppendString(sb, f.Name);
                sb.Append(",\"size\":");
                sb.Append(f.Size.HasValue ? f.Size.Value.ToString(CultureInfo.InvariantCulture) : "null");
                sb.Append(",\"isDir\":");
                sb.Append(f.IsDirectory.HasValue ? (f.IsDirectory.Value ? "true" : "false") : "null");
                sb.Append('}');
            }
            return sb.Append(']').ToString();
        }

        private static void AppendString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20)
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            sb.Append('"');
        }
    }
}
