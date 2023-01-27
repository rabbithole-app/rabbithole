import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Cycles "mo:base/ExperimentalCycles";

import IC "../types/ic";

actor class Wallet() = this {
    let ic : IC.Self = actor "aaaaa-aa";

    public func transferCycles(canisterId : Principal) : async () {
        let status = await ic.canister_status({ canister_id = Principal.fromActor(this) });
        let freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
        let availableCycles : Nat = Nat.sub(status.cycles, freezingThresholdInCycles);

        // We have to retain some cycles to be able to ultimately delete the canister
        let cycles : Nat = availableCycles - 50_000_000;

        if (availableCycles > 0) {
            Cycles.add(cycles);
            await ic.deposit_cycles({ canister_id = canisterId });
        };
    };
};
