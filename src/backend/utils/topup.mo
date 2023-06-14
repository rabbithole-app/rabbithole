import Iter "mo:base/Iter";
import List "mo:base/List";
import Buffer "mo:base/Buffer";
import Time "mo:base/Time";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Nat "mo:base/Nat";
import Deque "mo:base/Deque";
import Option "mo:base/Option";
import Cycles "mo:base/ExperimentalCycles";

import Logger "logger";
import JournalTypes "../journal/types";
import IC "../types/ic.types";

module {
    let CHECK_INTERVAL_NANOS = 20_000_000_000; // 60 seconds
    // минимальное кол-во циклов до вступления канистры в состояние заморозки, при котором необходимо пополнять канистру
    let MIN_CYCLE_SHARE = 250_000_000_000;
    type Canister = JournalTypes.Canister;

    public type Cycle = Nat;
    public type Balance = { icp : { var e8s : Nat64 }; var cycle : Cycle };
    public type UserStatus = {
        #DepositingCycle;
        #DepositSuccess;
        #DepositError : Text;
    };
    public type User = {
        id : Principal;
        // A user can delegate all its cycle balance to another user.
        // This is used to merge a temporary account into an authenticated account.
        var delegate : ?Principal;
        balance : Balance;
        // allocations: Queue<Allocation>;
        var last_updated : Time.Time;
        var status : ?UserStatus;
    };
    public type Token = { e8s : Nat64 };
    public type Deposit = { user : User; icp : Token };

    public class Topup(logger : Logger.Logger) {
        //var canisters : Deque.Deque<Canister> = Deque.empty<Canister>();
        var canisters : List.List<Canister> = List.nil<Canister>();
        var topupQueue : Deque.Deque<Canister> = Deque.empty<Canister>();
        var activeChecking : Bool = false;
        var toppingUp : ?Canister = null;
        // private let logger = Logger.new(100);
        private let ic : IC.Self = actor "aaaaa-aa";

        // We we are in stopping mode, new deposits or topup will not be processed.
        var stopping = false;

        // Deposit queue. Require users to ping to be added to this queue.
        var deposits : List.List<Deposit> = List.nil();

        type Stage = {
            #Mint;
            #MintCalled;
            // #Notify: Ledger.BlockIndex;
            #NotifyCalled;
        };

        type Depositing = (Deposit, Stage);

        // Current deposit in progress.
        var depositing : ?Depositing = null;

        public func push(canister : Canister) {
            canisters := List.push<Canister>(canister, canisters);
        };

        // Poll the deposit queue to convert from ICP to Cycle.
        // Inflight deposit should block canister topup, and vice versa.
        // Note that this is called from heartbeat, but can also be called manually by admin.
        public shared (arg) func poll() {
            // Only admin or self can call poll.
            if (not (arg.caller == Principal.fromActor(self) or arg.caller == OWNER)) return;

            // Only start working on the next deposit if we are not stopping.
            if (Option.isNull(depositing) and not stopping) {
                switch (Queue.popFront(deposits)) {
                    case null return;
                    case (?deposit) {
                        // We must TRAP if there is a topup in progress to avoid changing deposit queue.
                        assert (Option.isNull(topping_up));
                        depositing := ?(deposit, #Mint);
                    };
                };
            };
            let log = logger("poll");
            switch depositing {
                case (?(deposit, #Mint)) {
                    let user = deposit.user;
                    let from_subaccount = Util.principalToSubAccount(user.id);
                    let to_subaccount = Util.principalToSubAccount(Principal.fromActor(self));
                    let account = AccountId.fromPrincipal(CYCLE_MINTING_CANISTER, ?to_subaccount);
                    ignore log("BeforeTransfer " # debug_show ({ user = user.id; deposit = deposit.icp }));
                    try {
                        depositing := ?(deposit, #MintCalled);
                        let result = await Ledger.transfer({
                            to = Blob.fromArray(account);
                            fee = { e8s = FEE };
                            memo = TOP_UP_CANISTER_MEMO;
                            from_subaccount = ?Blob.fromArray(from_subaccount);
                            amount = { e8s = deposit.icp.e8s - 2 * FEE };
                            created_at_time = null;
                        });
                        ignore log("AfterTransfer " # debug_show ({ result = result }));
                        switch (result) {
                            case (#Ok(block_height)) {
                                depositing := ?(deposit, #Notify(block_height));
                            };
                            case (#Err(err)) {
                                depositing := null;
                                Util.setUserStatus(user, ? #DepositError(debug_show (err)));
                            };
                        };
                    } catch (err) {
                        // TODO: notify user?
                        ignore log("AfterTransfer " # show_error(err));
                        depositing := null;
                        Util.setUserStatus(user, ? #DepositError(Error.message(err)));
                    };
                };
                case (?(deposit, #Notify(block_height))) {
                    let user = deposit.user;
                    let from_subaccount = Util.principalToSubAccount(user.id);
                    let to_subaccount = Util.principalToSubAccount(Principal.fromActor(self));
                    let starting_cycles = Cycles.balance();
                    ignore log(
                        "BeforeNotify " #
                        debug_show ({ user = user.id; deposit = deposit.icp; starting_cycles = starting_cycles })
                    );
                    try {
                        depositing := ?(deposit, #NotifyCalled);
                        await Ledger.notify_dfx({
                            to_canister = CYCLE_MINTING_CANISTER;
                            block_height = block_height;
                            from_subaccount = ?Blob.fromArray(from_subaccount);
                            to_subaccount = ?Blob.fromArray(to_subaccount);
                            max_fee = { e8s = FEE };
                        });
                        let ending_cycles = Cycles.balance();
                        ignore log("AfterNotify " # debug_show ({ ending_cycles = ending_cycles }));
                        if (ending_cycles < starting_cycles) {
                            // TODO: notify user
                        } else {
                            tipjar.funded := tipjar.funded + ending_cycles - starting_cycles;
                            let beneficiary = Option.get(Option.chain(user.delegate, findUser), user);
                            let old_cycle = beneficiary.balance.cycle;
                            ignore Util.setUserCycle(
                                beneficiary,
                                beneficiary.balance.cycle + ending_cycles - starting_cycles
                            );
                            ignore log("TopUpCycle " # debug_show ({ user = beneficiary.id; delegate = beneficiary.id != user.id; old = old_cycle; new = beneficiary.balance.cycle }));
                        };
                        Util.setUserStatus(user, ? #DepositSuccess);
                    } catch (err) {
                        Util.setUserStatus(user, ? #DepositError(Error.message(err)));
                        ignore log("AfterNotify " # show_error(err));
                    };
                    depositing := null;
                };
                case (_)();
            };
        };

        // Poll the topup queue to top up the next canister.
        // Inflight topup should block user deposit, and vice versa.
        // Функция может быть вызвана из heartbeat или же админом напрямую
        private func topup() : async () {
            assert Option.isNull(toppingUp);
            // Do nothing if we are already doing a topup, or caller is not self or admin.
            // if (Option.isSome(toppingUp) or Principal.notEqual(caller, Principal.fromActor(this))) return;
            // if (not Utils.isAdmin(caller)) {
            //     throw Error.reject("Unauthorized access. Caller is not an admin. " # Principal.toText(caller));
            // };

            switch (Deque.popFront(topupQueue)) {
                case null {};
                case (?(canister, newTopupQueue)) {
                    let log = logger.log("topup");
                    let amount : Nat = do {
                        let availableCycles = Nat.sub(canister.cycles, canister.freezingThresholdInCycles);
                        Nat.max(MIN_CYCLE_SHARE, canister.idleCyclesBurnedPerDay * 10);
                        // canister.idleCyclesBurnedPerDay / 24;
                        // canister.freezingThresholdInCycles
                        // let amountForNext10Days = canister.idleCyclesBurnedPerDay * 10;
                        // if (MIN_CYCLE_GAP > amountForNext10Days) MIN_CYCLE_GAP else amountForNext10Days;
                    };
                    log("BeforeDeposit " # debug_show ({ canister = canister.canisterId; amount }));
                    Debug.print("BeforeDeposit" # debug_show ({ canister_id = canister.canisterId; amount }));
                    toppingUp := ?canister;
                    try {
                        Cycles.add(amount);
                        await ic.deposit_cycles({ canister_id = canister.canisterId });
                        Debug.print("AfterDeposit" # debug_show ({ canister_id = canister.canisterId }));
                        log("AfterDeposit");
                    } catch (err) {
                        Debug.print("AfterDeposit " # Error.message(err));
                        log("AfterDeposit " # Error.message(err));
                    };
                    toppingUp := null;
                    topupQueue := newTopupQueue;
                };
            };
        };

        public func monitor() : async () {
            ignore topup();

            assert not activeChecking;
            // проверяем первую канистру в очереди
            switch (List.pop<Canister>(canisters)) {
                case (null, _) {};
                case (?canister, _) {
                    let now = Time.now();
                    // в случае если время проверки настало
                    if (now - canister.lastChecked >= CHECK_INTERVAL_NANOS) {
                        let log = logger.log("heartbeat");
                        // log("Time" # debug_show ({ now; diff = now - canister.lastChecked }));
                        // берем из очереди первую канистру, обновляем данные о канистре, помещаем в конец очереди
                        // при необходимости помещаем в очередь на пополнение
                        switch (List.pop<Canister>(canisters)) {
                            case (null, _) {};
                            case (?canister, newCanisters) {
                                log("BeforeCheck " # debug_show ({ canister = canister.canisterId }));
                                Debug.print("BeforeCheck " # debug_show ({ canister = canister.canisterId }));
                                activeChecking := true;
                                try {
                                    let status = await ic.canister_status({ canister_id = canister.canisterId });
                                    let value = {
                                        canister with cycles = status.cycles;
                                        idleCyclesBurnedPerDay = status.idle_cycles_burned_per_day;
                                        freezingThreshold = status.settings.freezing_threshold;
                                        freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
                                        lastChecked = now;
                                    };
                                    // log("Fields " # debug_show ({ fields = value }));
                                    canisters := List.push<Canister>(value, newCanisters);
                                    let availableCycles = Nat.sub(value.cycles, value.freezingThresholdInCycles);
                                    log("AfterCheck " # debug_show ({ cycles = value.cycles; availableCycles }));
                                    Debug.print("AfterCheck " # debug_show ({ cycles = value.cycles; availableCycles }));
                                    // let isToppingUp = switch (toppingUp) {
                                    //     case null false;
                                    //     case (?{ canisterId }) Principal.equal(canister.canisterId, canisterId);
                                    // };
                                    if (availableCycles <= Nat.max(MIN_CYCLE_SHARE, value.idleCyclesBurnedPerDay * 10)) {
                                        log("EnqueueTopUp " # debug_show ({ canister = canister.canisterId }));
                                        Debug.print("EnqueueTopUp " # debug_show ({ canister = canister.canisterId }));
                                        topupQueue := Deque.pushBack(topupQueue, value);
                                        throw Error.reject("Произошла ошибка");
                                    };
                                    activeChecking := false;
                                } catch (err) {
                                    log("AfterCheck " # Error.message(err));
                                    Debug.print("AfterCheck " # Error.message(err));
                                    // { error = ?debug_show (Error.message(err)) };
                                    canisters := List.push<Canister>({ canister with error = ?Error.message(err); lastChecked = now }, newCanisters);
                                    activeChecking := false;
                                    // return;
                                };
                                // log("Fields " # debug_show ({ fields = updatedFields }));

                                // let value = { canister and updatedFields with lastChecked = Time.now() };
                                // let value = await monitorStorageBucket(canister.canisterId, ?canister);
                                // canisters := Deque.pushBack(newCanisters, value);
                            };
                        };
                    };
                };
            };
        };

        public func info() : {
            activeChecking : Bool;
            topupQueue : Deque.Deque<Canister>;
            canisters : List.List<Canister>;
            toppingUp : ?Canister;
            balance : Nat;
        } {
            { activeChecking; topupQueue; canisters; toppingUp; balance = Cycles.balance() };
        };

        public func preupgrade() : Iter.Iter<Canister> {
            List.toIter<Canister>(canisters);
        };

        public func postupgrade(stableData : [Canister]) {
            canisters := List.fromArray<Canister>(stableData);
        };
    };
};
