using System;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink
{
    /// <summary>
    /// Holds Contract Configurator objectives on the home command's objective
    /// delay line, so a Contract Configurator objective, which is every RP-1
    /// contract, is met, unmet or failed only when word from the craft that
    /// caused it reaches home. Declares no channels and no commands of its own,
    /// and has no client.
    /// </summary>
    [SitrepUplink("contractConfigurator")]
    public sealed partial class ContractConfiguratorUplink : ISitrepUplink
    {
        private readonly Func<bool> _isLoaded;
        private readonly Func<ObjectiveLineAccess, string?> _installHooks;
        private readonly Func<ObjectiveChange, Action?> _resolveRestored;

        private ObjectiveLineAccess? _access;
        private bool _loaded;
        private string? _hooksFailure;

        internal ContractConfiguratorUplink(
            Func<bool> isLoaded,
            Func<ObjectiveLineAccess, string?> installHooks,
            Func<ObjectiveChange, Action?> resolveRestored)
        {
            _isLoaded = isLoaded;
            _installHooks = installHooks;
            _resolveRestored = resolveRestored;
        }

        public UplinkManifest Manifest { get; } = new UplinkManifest
        {
            Id = "contractConfigurator",
            Version = UplinkBuildVersion.Value,
        };

        public UplinkHealth Health() =>
            ContractConfiguratorHealth.Of(_loaded, _hooksFailure, _access?.Missing ?? false);

        public void Register(IUplinkHost host)
        {
            _loaded = _isLoaded();
            if (!_loaded)
            {
                host.SetAvailability(Availability.Unavailable("Contract Configurator is not loaded"));
                return;
            }

            _access = new ObjectiveLineAccess(host.Kernel, _resolveRestored);
            _hooksFailure = _installHooks(_access);
            host.AddSampler(_access);
        }
    }
}
