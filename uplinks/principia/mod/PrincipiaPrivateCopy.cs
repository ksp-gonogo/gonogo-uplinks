using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// A private copy of the player's Principia build, running inside the game's process
    /// on a thread of its own and building a plugin of its own, so a path can start from
    /// a state the game is not holding. See <c>native/gonogo_principia.c</c> for how it
    /// stays apart from the player's plugin and survives a fatal check.
    ///
    /// <para>The native half is carried in this assembly and written beside it. Linux
    /// only so far: anywhere else <see cref="Open"/> returns null and an accurate ask is
    /// refused.</para>
    /// </summary>
    public sealed class PrincipiaPrivateCopy : IPrincipiaWorkerChannel
    {
        /// <summary>
        /// How long one request may take: long enough to catch a large solar system up
        /// across decades of game time. A copy that takes longer is set aside.
        /// </summary>
        private const int ReplyTimeoutSeconds = 600;

        private const string Library = "libgonogo_principia.so";

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate int InitDelegate();

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate IntPtr ExchangeDelegate(byte[] request, int timeoutSeconds);

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate void FreeDelegate(IntPtr reply);

        [DllImport("libdl.so.2", EntryPoint = "dlopen")]
        private static extern IntPtr DlOpen([MarshalAs(UnmanagedType.LPStr)] string path, int flags);

        [DllImport("libdl.so.2", EntryPoint = "dlsym")]
        private static extern IntPtr DlSym(IntPtr handle, [MarshalAs(UnmanagedType.LPStr)] string name);

        private const int RtldNow = 2;

        private readonly ExchangeDelegate _exchange;
        private readonly FreeDelegate _free;

        private PrincipiaPrivateCopy(ExchangeDelegate exchange, FreeDelegate free)
        {
            _exchange = exchange;
            _free = free;
        }

        /// <summary>
        /// Where the temporary copy of the build is written. It is deleted as soon as it is
        /// mapped, and it is outside GameData because that folder is often synced.
        /// </summary>
        public static string PrivateFileDirectory => Path.GetTempPath().TrimEnd('/');

        /// <summary>The native half written to <paramref name="directory"/>, or null when this build carries none or it cannot be written.</summary>
        public static string? EnsureLibrary(string directory)
        {
            try
            {
                using var resource = typeof(PrincipiaPrivateCopy).Assembly.GetManifestResourceStream(Library);
                if (resource == null)
                {
                    return null;
                }
                using var buffer = new MemoryStream();
                resource.CopyTo(buffer);
                var bytes = buffer.ToArray();
                var path = Path.Combine(directory, Library);
                if (!File.Exists(path) || new FileInfo(path).Length != bytes.Length || !Same(File.ReadAllBytes(path), bytes))
                {
                    Directory.CreateDirectory(directory);
                    File.WriteAllBytes(path, bytes);
                }
                return path;
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static bool Same(byte[] a, byte[] b)
        {
            for (var i = 0; i < a.Length; i++)
            {
                if (a[i] != b[i])
                {
                    return false;
                }
            }
            return true;
        }

        /// <summary>The copy's channel, or null where it cannot run: not Linux, or the native half will not load.</summary>
        public static IPrincipiaWorkerChannel? Open(string directory)
        {
            if (Environment.OSVersion.Platform != PlatformID.Unix)
            {
                return null;
            }
            var path = EnsureLibrary(directory);
            if (path == null)
            {
                return null;
            }
            try
            {
                var handle = DlOpen(path, RtldNow);
                if (handle == IntPtr.Zero)
                {
                    return null;
                }
                var init = Bind<InitDelegate>(handle, "gonogo_principia_init");
                var exchange = Bind<ExchangeDelegate>(handle, "gonogo_principia_exchange");
                var free = Bind<FreeDelegate>(handle, "gonogo_principia_free");
                if (init == null || exchange == null || free == null || init() != 0)
                {
                    return null;
                }
                return new PrincipiaPrivateCopy(exchange, free);
            }
            catch (Exception e) when (e is DllNotFoundException || e is EntryPointNotFoundException)
            {
                return null;
            }
        }

        private static T? Bind<T>(IntPtr handle, string name)
            where T : class
        {
            var symbol = DlSym(handle, name);
            return symbol == IntPtr.Zero ? null : Marshal.GetDelegateForFunctionPointer(symbol, typeof(T)) as T;
        }

        /// <summary>One request and its reply. Blocks the calling thread, so never call it on the game's.</summary>
        public string? Exchange(string request)
        {
            var bytes = Encoding.UTF8.GetBytes(request + "\0");
            var reply = _exchange(bytes, ReplyTimeoutSeconds);
            if (reply == IntPtr.Zero)
            {
                return null;
            }
            try
            {
                return Marshal.PtrToStringAnsi(reply);
            }
            finally
            {
                _free(reply);
            }
        }

        /// <summary>The copy lives until the game exits: unloading it would leave its pool threads on unmapped code.</summary>
        public void Dispose()
        {
        }
    }
}
