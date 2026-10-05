using System;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// Reads where KSP's space centre stands, for <see cref="RaHomeCommandProvider"/>,
    /// and remembers the last good reading.
    ///
    /// <para><c>SpaceCenter.Instance</c> is not readable everywhere. It is null until the
    /// component's <c>Awake</c> and again after its <c>OnDestroy</c>, and its body and
    /// coordinates are filled in only by <c>Start</c>; stock itself null-checks it
    /// everywhere but vessel recovery. The space centre does not move within a game,
    /// so the last reading stands in whenever the instance cannot be read.</para>
    ///
    /// <para>The component sits under the space centre's scenery, which stock leaves
    /// switched off until its planet's surface is first drawn. A game resumed straight
    /// into a flight far from that planet has therefore never run its <c>Awake</c>,
    /// and there is no instance and no last reading. The scenery is still placed, by
    /// a direction from the body's centre that is plain data on its
    /// <c>PQSCity</c>, so the place is read from there until the instance exists.</para>
    ///
    /// <para>Main thread only: it touches a Unity object.</para>
    /// </summary>
    internal sealed class RaSpaceCentre
    {
        private SpaceCentreFix? _last;

        public SpaceCentreFix? Read()
        {
            try
            {
                var spaceCentre = SpaceCenter.Instance;

                // The transform is set by Start, the same call that fills in the body
                // and coordinates, so a null one means those still hold defaults.
                if (spaceCentre != null && spaceCentre.cb != null && spaceCentre.SpaceCenterTransform != null)
                {
                    var bodies = FlightGlobals.Bodies;
                    var index = bodies != null ? bodies.IndexOf(spaceCentre.cb) : -1;
                    var latitude = spaceCentre.Latitude;
                    var longitude = spaceCentre.Longitude;
                    if (index >= 0 && IsReal(latitude) && IsReal(longitude))
                    {
                        _last = new SpaceCentreFix(index, latitude, longitude);
                    }
                }
            }
            catch (Exception)
            {
                // An unreadable space centre keeps the last reading, as an absent one does.
            }

            if (_last != null)
            {
                return _last;
            }

            // Looking over every loaded object is not a per-tick read, and the scenery is placed once.
            var now = UnityEngine.Time.realtimeSinceStartup;
            if (_placed == null && now >= _lookAgainAt)
            {
                _lookAgainAt = now + SecondsBetweenLooks;
                _placed = Placed();
            }

            return _placed;
        }

        private const float SecondsBetweenLooks = 5f;

        private SpaceCentreFix? _placed;
        private float _lookAgainAt;

        /// <summary>
        /// Where the space centre's scenery is placed, read off the objects themselves
        /// whether or not they have ever been switched on, or null when none is found.
        /// </summary>
        private static SpaceCentreFix? Placed()
        {
            try
            {
                var bodies = FlightGlobals.Bodies;
                if (bodies == null)
                {
                    return null;
                }

                // FindObjectsOfTypeAll also returns objects that are switched off, which FindObjectsOfType does not.
                foreach (var spaceCentre in UnityEngine.Resources.FindObjectsOfTypeAll<SpaceCenter>())
                {
                    if (spaceCentre == null)
                    {
                        continue;
                    }

                    PQSCity? city = null;
                    CelestialBody? body = null;
                    for (var at = spaceCentre.transform; at != null && body == null; at = at.parent)
                    {
                        if (city == null)
                        {
                            city = at.GetComponent<PQSCity>();
                        }
                        body = at.GetComponent<CelestialBody>();
                    }

                    // A prefab copy of the scenery hangs under no body in the game, and is passed over here.
                    var index = body != null ? bodies.IndexOf(body) : -1;

                    // Scenery not placed by a direction keeps the field's default, which points nowhere meant.
                    if (city == null || index < 0 || !(city.repositionToSphere || city.repositionToSphereSurface))
                    {
                        continue;
                    }

                    var radial = city.repositionRadial;
                    var fix = SpaceCentreFix.FromRadial(index, radial.x, radial.y, radial.z);
                    if (fix != null)
                    {
                        return fix;
                    }
                }
            }
            catch (Exception)
            {
                // Scenery that cannot be read places no space centre, and the next pass looks again.
            }

            return null;
        }

        private static bool IsReal(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}
