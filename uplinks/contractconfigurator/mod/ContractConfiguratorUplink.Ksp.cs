using System;
using System.Runtime.CompilerServices;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink
{
    public sealed partial class ContractConfiguratorUplink
    {
        public ContractConfiguratorUplink()
            : this(ContractConfiguratorLoaded, InstallHooks, Restore)
        {
        }

        private static bool ContractConfiguratorLoaded()
        {
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                if (string.Equals(assembly.GetName().Name, "ContractConfigurator", StringComparison.Ordinal))
                {
                    return true;
                }
            }
            return false;
        }

        // Kept out of line so the runtime resolves Contract Configurator's types
        // only when it is loaded.
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static string? InstallHooks(ObjectiveLineAccess access) => ContractConfiguratorHooks.Install(access);

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static Action? Restore(ObjectiveChange change) => ContractConfiguratorHooks.Restore(change);
    }
}
