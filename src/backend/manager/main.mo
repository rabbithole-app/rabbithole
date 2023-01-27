import TrieSet "mo:base/TrieSet";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import TrieMap "mo:base/TrieMap";
import Array "mo:base/Array";
import Result "mo:base/Result";
import Error "mo:base/Error";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Trie "mo:base/Trie";
import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Cycles "mo:base/ExperimentalCycles";

import IC "../types/ic.types";
import Types "types";
import StorageBucket "../storage/main";
import StorageTypes "../storage/types";
import WalletUtils "../utils/wallet.utils";

actor class ManagerBucket(owner : Principal) = this {
    private let STORAGE_BUCKET_CAPACITY = 2 * 1024 * 1024 * 1024;
    private let CYCLE_SHARE = 1_000_000_000_000;

    type Timestamp = Types.Timestamp;
    type Bucket = Types.Bucket;
    type BucketId = Types.BucketId;
    type Batch = StorageTypes.Batch;

    private stable var storageBuckets : TrieSet.Set<BucketId> = TrieSet.empty<BucketId>();

    private let ic : IC.Self = actor "aaaaa-aa";

    // Инициализация storage-канистры, если у caller еще нет канистры или все канистры заполнены, то создаем канистру
    private func getBucketWithAvailableCapacity(caller : Principal, fileSize : Nat) : async BucketId {
        var bucketId_ : ?BucketId = null;
        label bucketsLoop for (bucketId in Iter.fromArray(TrieSet.toArray(storageBuckets))) {
            let storageBucket : actor { getUsedMemorySize : shared () -> async Nat } = actor (Principal.toText(bucketId));
            let usedMemory = await storageBucket.getUsedMemorySize();
            if ((usedMemory + fileSize) <= STORAGE_BUCKET_CAPACITY) {
                bucketId_ := ?bucketId;
                break bucketsLoop;
            };
        };
        switch (bucketId_) {
            case null await createStorageBucket(caller);
            case (?v) v;
        };
    };

    // Создание канистры с хранилищем
    private func createStorageBucket(caller : Principal) : async BucketId {
        let self : Principal = Principal.fromActor(this);
        let settings = {
            controllers = ?[installer, self];
            freezing_threshold = null;
            memory_allocation = null;
            compute_allocation = null;
        };
        Cycles.add(CYCLE_SHARE);
        let { canister_id } = await ic.create_canister({ settings = ?settings });
        ignore await (system StorageBucket.StorageBucket)(#install canister_id)(caller);
        storageBuckets := TrieSet.put<BucketId>(storageBuckets, canister_id, Principal.hash(canister_id), Principal.equal);
        canister_id;
    };

    // Удаление канистры пользователя
    private func deleteStorageBucket(caller : Principal, bucketId : BucketId) : async Result.Result<(), Text> {
        switch (TrieSet.mem<BucketId>(storageBuckets, bucketId, Principal.hash(bucketId), Principal.equal)) {
            case false #err("Bucket " # Principal.toText(bucketId) # " not found. " # Principal.toText(caller));
            case true {
                let arg = { canister_id = bucketId };
                // await ic.uninstall_code(arg);
                // await (system WalletUtils.WalletUtils)(#install bucketId);
                // let { cycles; settings; idle_cycles_burned_per_day } = await ic.canister_status(arg);
                await ic.stop_canister(arg);
                await ic.delete_canister(arg);
                #ok();
            };
        };
    };

    public query ({ caller }) func getStorages() : async [BucketId] {
        TrieSet.toArray<BucketId>(storageBuckets);
    };

    private func isStorage(bucketId : BucketId) : Bool {
        TrieSet.mem<BucketId>(storageBuckets, bucketId, Principal.hash(bucketId), Principal.equal);
    };

    // public query ({ caller }) func getStorageSize() : async Nat {
    //     assert not Principal.isAnonymous(caller);
    //     assert Principal.equal(caller, owner);

    //     var size : Nat = 0;
    //     for ({ usedMemory } in buckets.vals()) {
    //         size += usedMemory;
    //     };
    //     size;
    // };

    /**
     * Utils
     */;
};
