using System.Text;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// CityHash64 (CityHash v1.1) over a string's UTF-8 bytes: the key a Principia build
    /// that names bodies by "city" gives a body, from its name.
    ///
    /// <para>Computed here rather than asked of Principia so a body key can be resolved
    /// anywhere a body name is known, with no call into the producer. It must agree with
    /// <c>principia__CityHash64</c> bit for bit, which the vectors in its tests were read
    /// from.</para>
    /// </summary>
    public static class CityHash
    {
        private const ulong K0 = 0xc3a5c85c97cb3127UL;
        private const ulong K1 = 0xb492b66fbe98f273UL;
        private const ulong K2 = 0x9ae16a3b2f90404fUL;
        private const ulong KMul = 0x9ddfea08eb382d69UL;

        public static ulong Hash64(string text) => Hash64(Encoding.UTF8.GetBytes(text ?? string.Empty));

        public static ulong Hash64(byte[] s)
        {
            var len = s.Length;
            if (len <= 32)
            {
                return len <= 16 ? HashLen0To16(s, 0, len) : HashLen17To32(s, len);
            }
            if (len <= 64)
            {
                return HashLen33To64(s, len);
            }

            var x = Fetch64(s, len - 40);
            var y = Fetch64(s, len - 16) + Fetch64(s, len - 56);
            var z = HashLen16(Fetch64(s, len - 48) + (ulong)len, Fetch64(s, len - 24));
            var v = WeakHashLen32WithSeeds(s, len - 64, (ulong)len, z);
            var w = WeakHashLen32WithSeeds(s, len - 32, y + K1, x);
            x = x * K1 + Fetch64(s, 0);

            var at = 0;
            var remaining = (len - 1) & ~63;
            do
            {
                x = Rotate(x + y + v.First + Fetch64(s, at + 8), 37) * K1;
                y = Rotate(y + v.Second + Fetch64(s, at + 48), 42) * K1;
                x ^= w.Second;
                y += v.First + Fetch64(s, at + 40);
                z = Rotate(z + w.First, 33) * K1;
                v = WeakHashLen32WithSeeds(s, at, v.Second * K1, x + w.First);
                w = WeakHashLen32WithSeeds(s, at + 32, z + w.Second, y + Fetch64(s, at + 16));
                var swap = z;
                z = x;
                x = swap;
                at += 64;
                remaining -= 64;
            }
            while (remaining != 0);

            return HashLen16(
                HashLen16(v.First, w.First) + ShiftMix(y) * K1 + z,
                HashLen16(v.Second, w.Second) + x);
        }

        private readonly struct Pair
        {
            public Pair(ulong first, ulong second)
            {
                First = first;
                Second = second;
            }

            public ulong First { get; }
            public ulong Second { get; }
        }

        private static ulong Fetch64(byte[] s, int at)
        {
            ulong value = 0;
            for (var i = 7; i >= 0; i--)
            {
                value = (value << 8) | s[at + i];
            }
            return value;
        }

        private static uint Fetch32(byte[] s, int at) =>
            (uint)(s[at] | (s[at + 1] << 8) | (s[at + 2] << 16) | (s[at + 3] << 24));

        private static ulong Rotate(ulong value, int shift) =>
            shift == 0 ? value : (value >> shift) | (value << (64 - shift));

        private static ulong ShiftMix(ulong value) => value ^ (value >> 47);

        private static ulong Bswap(ulong value)
        {
            ulong result = 0;
            for (var i = 0; i < 8; i++)
            {
                result = (result << 8) | (value & 0xff);
                value >>= 8;
            }
            return result;
        }

        private static ulong HashLen16(ulong u, ulong v) => HashLen16(u, v, KMul);

        private static ulong HashLen16(ulong u, ulong v, ulong mul)
        {
            var a = (u ^ v) * mul;
            a ^= a >> 47;
            var b = (v ^ a) * mul;
            b ^= b >> 47;
            return b * mul;
        }

        private static ulong HashLen0To16(byte[] s, int at, int len)
        {
            if (len >= 8)
            {
                var mul = K2 + (ulong)len * 2;
                var a = Fetch64(s, at) + K2;
                var b = Fetch64(s, at + len - 8);
                var c = Rotate(b, 37) * mul + a;
                var d = (Rotate(a, 25) + b) * mul;
                return HashLen16(c, d, mul);
            }
            if (len >= 4)
            {
                var mul = K2 + (ulong)len * 2;
                ulong a = Fetch32(s, at);
                return HashLen16((ulong)len + (a << 3), Fetch32(s, at + len - 4), mul);
            }
            if (len > 0)
            {
                ulong a = s[at];
                ulong b = s[at + (len >> 1)];
                ulong c = s[at + len - 1];
                var y = a + (b << 8);
                var z = (ulong)len + (c << 2);
                return ShiftMix((y * K2) ^ (z * K0)) * K2;
            }
            return K2;
        }

        private static ulong HashLen17To32(byte[] s, int len)
        {
            var mul = K2 + (ulong)len * 2;
            var a = Fetch64(s, 0) * K1;
            var b = Fetch64(s, 8);
            var c = Fetch64(s, len - 8) * mul;
            var d = Fetch64(s, len - 16) * K2;
            return HashLen16(
                Rotate(a + b, 43) + Rotate(c, 30) + d,
                a + Rotate(b + K2, 18) + c,
                mul);
        }

        private static ulong HashLen33To64(byte[] s, int len)
        {
            var mul = K2 + (ulong)len * 2;
            var a = Fetch64(s, 0) * K2;
            var b = Fetch64(s, 8);
            var c = Fetch64(s, len - 24);
            var d = Fetch64(s, len - 32);
            var e = Fetch64(s, 16) * K2;
            var f = Fetch64(s, 24) * 9;
            var g = Fetch64(s, len - 8);
            var h = Fetch64(s, len - 16) * mul;
            var u = Rotate(a + g, 43) + (Rotate(b, 30) + c) * 9;
            var v = ((a + g) ^ d) + f + 1;
            var w = Bswap((u + v) * mul) + h;
            var x = Rotate(e + f, 42) + c;
            var y = (Bswap((v + w) * mul) + g) * mul;
            var z = e + f + c;
            a = Bswap((x + z) * mul + y) + b;
            b = ShiftMix((z + a) * mul + d + h) * mul;
            return b + x;
        }

        private static Pair WeakHashLen32WithSeeds(byte[] s, int at, ulong a, ulong b) =>
            WeakHashLen32WithSeeds(
                Fetch64(s, at), Fetch64(s, at + 8), Fetch64(s, at + 16), Fetch64(s, at + 24), a, b);

        private static Pair WeakHashLen32WithSeeds(
            ulong w, ulong x, ulong y, ulong z, ulong a, ulong b)
        {
            a += w;
            b = Rotate(b + a + z, 21);
            var c = a;
            a += x;
            a += y;
            b += Rotate(a, 44);
            return new Pair(a + z, b + c);
        }
    }
}
