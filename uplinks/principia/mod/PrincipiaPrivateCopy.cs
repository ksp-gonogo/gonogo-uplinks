using System;
using System.Diagnostics;
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
        private const string WorkerProgram = "gonogo_principia_worker";

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate int InitDelegate();

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate IntPtr ExchangeDelegate(byte[] request, int timeoutSeconds);

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate void FreeDelegate(IntPtr reply);

        [DllImport("libc", EntryPoint = "chmod")]
        private static extern int ChMod([MarshalAs(UnmanagedType.LPStr)] string path, int mode);

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

        /// <summary>
        /// The same requests answered by a program of its own, the other route, for
        /// comparing the two. A fatal check ends that program and never the game.
        /// Null where it cannot start.
        /// </summary>
        public static IPrincipiaWorkerChannel? OpenSeparateProcess(string directory)
        {
            if (Environment.OSVersion.Platform != PlatformID.Unix)
            {
                return null;
            }
            try
            {
                using var resource = typeof(PrincipiaPrivateCopy).Assembly.GetManifestResourceStream(WorkerProgram);
                if (resource == null)
                {
                    return null;
                }
                using var buffer = new MemoryStream();
                resource.CopyTo(buffer);
                Directory.CreateDirectory(directory);
                var path = Path.Combine(directory, WorkerProgram);
                File.WriteAllBytes(path, buffer.ToArray());
                if (ChMod(path, 0x1ED) != 0)
                {
                    return null;
                }
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo(path)
                    {
                        RedirectStandardInput = true,
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    },
                };
                return process.Start() ? new ProcessChannel(process) : null;
            }
            catch (Exception)
            {
                return null;
            }
        }

        private sealed class ProcessChannel : IPrincipiaWorkerChannel
        {
            private readonly Process _process;

            public ProcessChannel(Process process) => _process = process;

            public string? Exchange(string request)
            {
                var bytes = Encoding.UTF8.GetBytes(request);
                var input = _process.StandardInput;
                input.Write(bytes.Length.ToString(System.Globalization.CultureInfo.InvariantCulture) + "\n");
                input.Flush();
                input.BaseStream.Write(bytes, 0, bytes.Length);
                input.BaseStream.Flush();
                var reply = _process.StandardOutput.ReadLineAsync();
                if (reply.Wait(ReplyTimeoutSeconds * 1000))
                {
                    return reply.Result;
                }
                _process.Kill();
                return null;
            }

            public void Dispose()
            {
                try
                {
                    if (!_process.HasExited)
                    {
                        _process.Kill();
                    }
                }
                catch (Exception)
                {
                    // Disposing runs on a thread nothing is watching.
                }
                _process.Dispose();
            }
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
