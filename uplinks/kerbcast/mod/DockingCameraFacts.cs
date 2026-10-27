namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Whether one camera is a docking camera: a camera whose own part carries a
    /// docking node. A camera merely mounted near a port is not one.
    ///
    /// <para>All-null (<c>default</c>) is the "could not determine" reading,
    /// deliberately distinct from <c>IsDockingCamera = false</c>, which means
    /// the part was read and has no docking node.</para>
    /// </summary>
    public struct DockingCameraFacts
    {
        /// <summary>True when the camera's own part carries a docking node; null when undeterminable.</summary>
        public bool? IsDockingCamera;

        /// <summary>The docking node's <c>nodeType</c> (e.g. <c>size1</c>), or null.</summary>
        public string? NodeType;

        /// <summary>The docking node's live <c>state</c> (e.g. <c>Ready</c>, <c>Docked</c>), or null.</summary>
        public string? State;

        /// <summary>The facts kerbcast reported on <paramref name="view"/>. An empty node type or state is absence.</summary>
        public static DockingCameraFacts FromView(KerbcastView view) =>
            view.HasDockingNode switch
            {
                null => default,
                false => new DockingCameraFacts { IsDockingCamera = false },
                true => new DockingCameraFacts
                {
                    IsDockingCamera = true,
                    NodeType = string.IsNullOrEmpty(view.DockingNodeType) ? null : view.DockingNodeType,
                    State = string.IsNullOrEmpty(view.DockingNodeState) ? null : view.DockingNodeState,
                },
            };
    }
}
