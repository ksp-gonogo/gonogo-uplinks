using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using Contracts;
using ContractConfigurator.Parameters;
using HarmonyLib;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink
{
    /// <summary>
    /// Harmony prefixes on the one method every Contract Configurator objective
    /// changes state through, and the route that finds an objective again by its
    /// contract and path to make a held change when it arrives.
    ///
    /// <para>The objective's live state always means what home knows. A change
    /// from the craft goes on the delay line and the objective keeps asking; the
    /// line absorbs the repeats. Members of a vessel group set their own state
    /// directly when the group's tracked craft changes, so they follow the craft;
    /// the group's state, the contract's outcome and every reward follow home.</para>
    /// </summary>
    internal static class ContractConfiguratorHooks
    {
        private const string HarmonyId = "gonogo.contractconfigurator.objectivedelay";

        private static readonly PendingLedger Ledger = new PendingLedger();

        [ThreadStatic]
        private static bool _replaying;

        // The craft a VesselParameter is checking, innermost last.
        private static readonly Stack<Vessel> Checking = new Stack<Vessel>();

        private static ObjectiveLineAccess? _access;

        private static readonly AccessTools.FieldRef<ContractParameter, bool> EnabledOf =
            AccessTools.FieldRefAccess<ContractParameter, bool>("enabled");

        private static readonly AccessTools.FieldRef<Timer, double> EndTimeOf =
            AccessTools.FieldRefAccess<Timer, double>("endTime");

        private static readonly MethodInfo? ReadyToCompleteMethod =
            AccessTools.Method(typeof(ContractConfiguratorParameter), "ReadyToComplete");

        private static readonly MethodInfo? SetStateMethod =
            AccessTools.Method(typeof(ContractConfiguratorParameter), nameof(ContractConfiguratorParameter.SetState), new[] { typeof(ParameterState) });

        private static readonly MethodInfo? CheckVesselMethod =
            AccessTools.Method(typeof(VesselParameter), "CheckVessel");

        /// <returns>Why the hooks could not be installed, or null when they were.</returns>
        public static string? Install(ObjectiveLineAccess access)
        {
            _access = access;
            try
            {
                if (SetStateMethod == null || ReadyToCompleteMethod == null || CheckVesselMethod == null)
                {
                    throw new MissingMethodException("a Contract Configurator method the objective hooks patch was not found");
                }
                var harmony = new Harmony(HarmonyId);
                harmony.Patch(SetStateMethod, prefix: Method(nameof(SetStatePrefix)));
                harmony.Patch(CheckVesselMethod, prefix: Method(nameof(CheckVesselPrefix)), finalizer: Method(nameof(CheckVesselFinalizer)));
                return null;
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        private static HarmonyMethod Method(string name) =>
            new HarmonyMethod(typeof(ContractConfiguratorHooks).GetMethod(name, BindingFlags.Static | BindingFlags.NonPublic));

        private static void CheckVesselPrefix(Vessel vessel) => Checking.Push(vessel);

        private static Exception? CheckVesselFinalizer(Exception __exception)
        {
            if (Checking.Count > 0)
            {
                Checking.Pop();
            }
            return __exception;
        }

        /// <returns>True to let the game make the change now.</returns>
        private static bool SetStatePrefix(ContractConfiguratorParameter __instance, ParameterState state)
        {
            if (_replaying)
            {
                return true;
            }
            try
            {
                var line = _access?.Line;
                var contract = __instance.Root;
                if (line == null || contract == null || contract.ContractState != Contract.State.Active)
                {
                    return true;
                }
                var path = PathOf(__instance);
                if (path == null)
                {
                    return true;
                }

                var target = TargetOf(state);
                var contractId = contract.ContractGuid;
                var timer = __instance as Timer;
                var facts = new HoldFacts
                {
                    Target = target,
                    Current = StateOf(__instance.State),
                    Enabled = __instance.Enabled,
                    ReadyToComplete = target != ObjectiveState.Met || ReadyToComplete(__instance),
                    IsTimer = timer != null,
                    TimerEndUt = timer != null && EndTimeOf(timer) > 0.0 ? EndTimeOf(timer) : (double?)null,
                    SourceVesselId = SourceCraftId(__instance),
                    PendingTarget = Ledger.LatestTarget(contractId, path, id => line.HasHeldAtOrBefore(id, double.MaxValue)),
                };

                switch (ObjectiveHoldPolicy.Decide(facts, ut => line.HasHeldAtOrBefore(contractId, ut)))
                {
                    case HoldAction.Skip:
                        return false;
                    case HoldAction.Hold:
                        var change = new ObjectiveChange
                        {
                            ContractId = contractId,
                            OwnerId = ObjectiveDelayCapability.ContractConfiguratorOwner,
                            ObjectivePath = path,
                            Target = target,
                            SourceVesselIds = new[] { facts.SourceVesselId },
                            CraftUt = Planetarium.GetUniversalTime(),
                            Description = __instance.Title ?? "",
                        };
                        if (!line.Hold(change, () => Apply(change)))
                        {
                            return true;
                        }
                        Ledger.Held(contractId, path, target);
                        return false;
                    default:
                        return true;
                }
            }
            catch (Exception ex)
            {
                GonogoLog(ex);
                return true;
            }
        }

        /// <summary>
        /// The apply for a change a loaded save restored. The objective is looked
        /// up when the change arrives, because contracts load after the line does.
        /// </summary>
        public static Action? Restore(ObjectiveChange change)
        {
            Ledger.Held(change.ContractId, change.ObjectivePath, change.Target);
            return () => Apply(change);
        }

        /// <summary>
        /// Makes a held change through the objective's own method. A Contract
        /// Configurator objective disables itself right after asking for a state
        /// it only ever reaches once, which leaves it refusing the change when
        /// the held one arrives, so it is enabled for the duration of the call.
        /// Throws when the objective can no longer be found, which drops it.
        /// </summary>
        private static void Apply(ObjectiveChange change)
        {
            try
            {
                var objective = Find(FindContract(change.ContractId), change.ObjectivePath)
                    ?? throw new InvalidOperationException("objective " + change.ObjectivePath + " of contract " + change.ContractId + " is gone");
                var wasEnabled = objective.Enabled;
                var previous = _replaying;
                _replaying = true;
                try
                {
                    if (!wasEnabled)
                    {
                        EnabledOf(objective) = true;
                    }
                    objective.SetState(StateFor(change.Target));
                }
                finally
                {
                    _replaying = previous;
                    if (!wasEnabled)
                    {
                        EnabledOf(objective) = false;
                    }
                }
            }
            finally
            {
                Ledger.Settled(change.ContractId, change.ObjectivePath);
            }
        }

        private static void GonogoLog(Exception ex) =>
            Console.Error.WriteLine("[ContractConfiguratorUplink] holding an objective change failed (applying it now): " + ex.Message);

        private static bool ReadyToComplete(ContractConfiguratorParameter objective) =>
            ReadyToCompleteMethod == null || (bool)ReadyToCompleteMethod.Invoke(objective, null);

        /// <summary>
        /// The craft whose action caused the change: the craft its vessel group
        /// tracks, else the craft being checked, else the craft being flown.
        /// Empty outside all three, which makes the change a home event.
        /// </summary>
        private static string SourceCraftId(ContractConfiguratorParameter objective)
        {
            IContractParameterHost? node = objective;
            for (var depth = 0; node is ContractParameter parameter && depth < 64; depth++)
            {
                if (parameter is VesselParameterGroup group && group.TrackedVessel != null)
                {
                    return group.TrackedVessel.id.ToString();
                }
                node = parameter.Parent;
            }
            if (Checking.Count > 0 && Checking.Peek() != null)
            {
                return Checking.Peek().id.ToString();
            }
            return HighLogic.LoadedSceneIsFlight && FlightGlobals.ActiveVessel != null
                ? FlightGlobals.ActiveVessel.id.ToString()
                : "";
        }

        private static Contract? FindContract(Guid contractId)
        {
            var contracts = ContractSystem.Instance?.Contracts;
            if (contracts == null)
            {
                return null;
            }
            foreach (var contract in contracts)
            {
                if (contract != null && contract.ContractGuid == contractId)
                {
                    return contract;
                }
            }
            return null;
        }

        private static ContractConfiguratorParameter? Find(Contract? contract, string path)
        {
            if (contract == null || string.IsNullOrEmpty(path))
            {
                return null;
            }
            ContractParameter? current = null;
            foreach (var step in path.Split('/'))
            {
                if (!int.TryParse(step, NumberStyles.None, CultureInfo.InvariantCulture, out var index))
                {
                    return null;
                }
                var count = current == null ? contract.ParameterCount : current.ParameterCount;
                if (index < 0 || index >= count)
                {
                    return null;
                }
                current = current == null ? contract.GetParameter(index) : current.GetParameter(index);
            }
            return current as ContractConfiguratorParameter;
        }

        /// <summary>The child index at each level joined by '/', or null when the objective is not attached to a contract.</summary>
        private static string? PathOf(ContractParameter objective)
        {
            var path = "";
            var node = objective;
            for (var depth = 0; depth < 64; depth++)
            {
                var index = IndexInParent(node);
                if (index < 0)
                {
                    return null;
                }
                path = path.Length == 0 ? index.ToString(CultureInfo.InvariantCulture) : index + "/" + path;
                if (node.Parent is ContractParameter parent)
                {
                    node = parent;
                    continue;
                }
                return node.Parent is Contract ? path : null;
            }
            return null;
        }

        private static int IndexInParent(ContractParameter objective)
        {
            switch (objective.Parent)
            {
                case Contract contract:
                    for (var i = 0; i < contract.ParameterCount; i++)
                    {
                        if (ReferenceEquals(contract.GetParameter(i), objective)) return i;
                    }
                    return -1;
                case ContractParameter parent:
                    for (var i = 0; i < parent.ParameterCount; i++)
                    {
                        if (ReferenceEquals(parent.GetParameter(i), objective)) return i;
                    }
                    return -1;
                default:
                    return -1;
            }
        }

        private static ObjectiveState TargetOf(ParameterState state) => state switch
        {
            ParameterState.Complete => ObjectiveState.Met,
            ParameterState.Failed => ObjectiveState.Failed,
            _ => ObjectiveState.Unmet,
        };

        private static ObjectiveState? StateOf(ParameterState state) => state switch
        {
            ParameterState.Complete => ObjectiveState.Met,
            ParameterState.Incomplete => ObjectiveState.Unmet,
            ParameterState.Failed => ObjectiveState.Failed,
            _ => null,
        };

        private static ParameterState StateFor(ObjectiveState target) => target switch
        {
            ObjectiveState.Met => ParameterState.Complete,
            ObjectiveState.Failed => ParameterState.Failed,
            _ => ParameterState.Incomplete,
        };
    }
}
