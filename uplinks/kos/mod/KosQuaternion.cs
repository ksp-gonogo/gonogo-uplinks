// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// The Unity quaternion-to-euler conversion, in managed code. kOS prints a
    /// direction as the euler angles Unity's native routine returns, which
    /// cannot run outside the game.
    /// </summary>
    public static class KosQuaternion
    {
        private const double Rad2Deg = 180.0 / Math.PI;

        /// <summary>Pitch (x), yaw (y) and roll (z) in degrees, each in [0, 360), for the quaternion (x, y, z, w).</summary>
        public static (double pitch, double yaw, double roll) ToEulerDegrees(double x, double y, double z, double w)
        {
            var unit = x * x + y * y + z * z + w * w;
            var test = x * w - y * z;
            double pitch;
            double yaw;
            double roll;
            if (test > 0.4995 * unit)
            {
                yaw = 2.0 * Math.Atan2(y, x);
                pitch = Math.PI / 2.0;
                roll = 0.0;
            }
            else if (test < -0.4995 * unit)
            {
                yaw = -2.0 * Math.Atan2(y, x);
                pitch = -Math.PI / 2.0;
                roll = 0.0;
            }
            else
            {
                // Unity permutes the components before extracting: (w, z, x, y).
                var qx = w;
                var qy = z;
                var qz = x;
                var qw = y;
                yaw = Math.Atan2(2.0 * qx * qw + 2.0 * qy * qz, 1.0 - 2.0 * (qz * qz + qw * qw));
                pitch = Math.Asin(Math.Max(-1.0, Math.Min(1.0, 2.0 * (qx * qz - qw * qy))));
                roll = Math.Atan2(2.0 * qx * qy + 2.0 * qz * qw, 1.0 - 2.0 * (qy * qy + qz * qz));
            }
            return (Normalize(pitch * Rad2Deg), Normalize(yaw * Rad2Deg), Normalize(roll * Rad2Deg));
        }

        private static double Normalize(double degrees)
        {
            var wrapped = degrees % 360.0;
            if (wrapped < 0.0)
            {
                wrapped += 360.0;
            }
            return wrapped;
        }
    }
}
