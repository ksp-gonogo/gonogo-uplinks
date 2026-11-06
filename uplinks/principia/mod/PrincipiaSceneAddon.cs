using HarmonyLib;
using UnityEngine;

namespace GonogoPrincipiaUplink
{
    /// <summary>Finds Principia's addon in the scene the game is showing.</summary>
    internal static class PrincipiaSceneAddon
    {
        private const string AdapterTypeName = "principia.ksp_plugin_adapter.PrincipiaPluginAdapter";

        /// <summary>
        /// A cache that looks the addon up in the current scene and drops it when
        /// the game destroys it. Unity's own null check is what sees a destroyed
        /// object, so it is asked through the <see cref="UnityEngine.Object"/> type.
        /// </summary>
        public static PrincipiaAddonCache ForAdapter() => new PrincipiaAddonCache(
            find: () =>
            {
                var adapterType = AccessTools.TypeByName(AdapterTypeName);
                return adapterType == null ? null : UnityEngine.Object.FindObjectOfType(adapterType);
            },
            isAlive: addon => addon is UnityEngine.Object unity ? unity != null : true);
    }
}
