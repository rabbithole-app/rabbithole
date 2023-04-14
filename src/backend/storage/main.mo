import Nat64 "mo:base/Nat64";
import Hash "mo:base/Hash";
import Principal "mo:base/Principal";
import Error "mo:base/Error";
import Option "mo:base/Option";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Result "mo:base/Result";
import HashMap "mo:base/HashMap";
import Nat "mo:base/Nat";
import Time "mo:base/Time";
import Trie "mo:base/Trie";
import StableMemory "mo:base/ExperimentalStableMemory";
import Cycles "mo:base/ExperimentalCycles";

import StorageTypes "types";
import Types "../types/types";
import HTTP "../types/http";
import JournalTypes "../journal/types";
import Utils "../utils/utils";
import IC "../types/ic";
import Debug "mo:base/Debug";
import Iter "mo:base/Iter";

shared ({ caller = installer }) actor class StorageBucket(owner : Principal) = this {
    private let BATCH_EXPIRY_NANOS = 300_000_000_000;
    // минимальное кол-во циклов до вступления канистры в состояние заморозки, при котором необходимо пополнять канистру
    private let CYCLE_THRESHOLD = 250_000_000_000;

    type Asset = StorageTypes.Asset;
    type AssetKey = StorageTypes.AssetKey;
    type ID = Types.ID;
    type AssetEncoding = StorageTypes.AssetEncoding;
    type Chunk = StorageTypes.Chunk;
    type Batch = StorageTypes.Batch;

    type HttpRequest = HTTP.HttpRequest;
    type HttpResponse = HTTP.HttpResponse;
    type HeaderField = HTTP.HeaderField;
    type StreamingCallbackHttpResponse = HTTP.StreamingCallbackHttpResponse;
    type StreamingCallbackToken = HTTP.StreamingCallbackToken;
    type StreamingStrategy = HTTP.StreamingStrategy;

    stable var assets : Trie.Trie<Text, Asset> = Trie.empty();
    var batches : HashMap.HashMap<Nat, Batch> = HashMap.HashMap<Nat, Batch>(10, Nat.equal, Hash.hash);
    var chunks : HashMap.HashMap<Nat, Chunk> = HashMap.HashMap<Nat, Chunk>(10, Nat.equal, Hash.hash);
    var nextBatchID : Nat = 0;
    var nextChunkID : Nat = 0;
    let journal : JournalTypes.Self = actor (Principal.toText(installer));
    let ic : IC.Self = actor "aaaaa-aa";

    // таймер мониторинга циклов
    // private let timerId : ?Nat = null;
    // private let ic : IC.Self = actor "aaaaa-aa";

    /**
     * HTTP
     */

    public shared query ({ caller }) func http_request({ method : Text; url : Text } : HttpRequest) : async HttpResponse {
        try {
            if (Text.notEqual(method, "GET")) {
                return {
                    body = Text.encodeUtf8("Method Not Allowed.");
                    headers = [];
                    status_code = 405;
                    streaming_strategy = null;
                };
            };

            let result : Result.Result<Asset, Text> = getAssetForUrl(url);

            switch (result) {
                case (#ok { key : AssetKey; headers : [HeaderField]; encoding : AssetEncoding }) {
                    return {
                        body = encoding.contentChunks[0];
                        headers;
                        status_code = 200;
                        streaming_strategy = createStrategy(key, encoding, headers);
                    };
                };
                case (#err error) {};
            };

            return {
                body = Text.encodeUtf8("Permission denied. Could not perform this operation.");
                headers = [];
                status_code = 403;
                streaming_strategy = null;
            };
        } catch (err) {
            return {
                body = Text.encodeUtf8("Unexpected error: " # Error.message(err));
                headers = [];
                status_code = 500;
                streaming_strategy = null;
            };
        };
    };

    public shared query ({ caller }) func http_request_streaming_callback(
        streamingToken : StreamingCallbackToken
    ) : async StreamingCallbackHttpResponse {
        let result : Result.Result<Asset, Text> = getAsset(streamingToken.id);

        switch (result) {
            case (#ok { key : AssetKey; headers : [HeaderField]; encoding : AssetEncoding }) {
                return {
                    token = createToken(key, streamingToken.index, encoding, headers);
                    body = encoding.contentChunks[streamingToken.index];
                };
            };
            case (#err error) {
                throw Error.reject("Streamed asset not found: " # error);
            };
        };
    };

    func createStrategy(key : AssetKey, encoding : AssetEncoding, headers : [HeaderField]) : ?StreamingStrategy {
        let streamingToken : ?StreamingCallbackToken = createToken(key, 0, encoding, headers);

        switch (streamingToken) {
            case null null;
            case (?streamingToken) {
                // Hack: https://forum.dfinity.org/t/cryptic-error-from-icx-proxy/6944/8
                // Issue: https://github.com/dfinity/candid/issues/273

                let self : Principal = Principal.fromActor(this);
                let canisterId : Text = Principal.toText(self);

                let canister = actor (canisterId) : actor {
                    http_request_streaming_callback : shared () -> async ();
                };

                return ?#Callback({
                    token = streamingToken;
                    callback = canister.http_request_streaming_callback;
                });
            };
        };
    };

    func createToken(key : AssetKey, chunkIndex : Nat, encoding : AssetEncoding, headers : [HeaderField]) : ?StreamingCallbackToken {
        if (chunkIndex + 1 >= encoding.contentChunks.size()) {
            return null;
        };

        let streamingToken : ?StreamingCallbackToken = ?{
            id = key.id;
            headers;
            index = chunkIndex + 1;
            sha256 = null;
        };

        return streamingToken;
    };

    func getAssetForUrl(url : Text) : Result.Result<Asset, Text> {
        if (Text.size(url) == 0) {
            return #err "No url provided.";
        };

        let id = Text.trimStart(url, #char '/');
        getAsset(id);
    };

    func getAsset(id : ID) : Result.Result<Asset, Text> {
        switch (Trie.get<Text, Asset>(assets, Utils.keyText(id), Text.equal)) {
            case (?asset) #ok asset;
            case null #err "No asset.";
        };
    };

    /**
     * Upload
     */

    public shared ({ caller }) func initUpload(key : AssetKey) : async ({ batchId : Nat }) {
        if (Principal.notEqual(caller, owner)) {
            throw Error.reject("User does not have the permission to upload data.");
        };

        nextBatchID := nextBatchID + 1;
        let now : Time.Time = Time.now();
        clearExpiredBatches();
        let batch = { key; expiresAt = now + BATCH_EXPIRY_NANOS };
        batches.put(nextBatchID, batch);
        // let manager : actor { initUpload : shared (batch : Batch) -> async () } = actor (Principal.toText(installer));
        // ignore manager.initUpload(batch);
        // activateTimer();

        return { batchId = nextBatchID };
    };

    // private func activateTimer(): () {
    //     switch timerId {
    //         case null {
    //             timerId := ?setTimer(Nat64.fromIntWrap(Time.now()) + 60_000_000_000, true, monitorCycles);
    //         };
    //         case (?_) {};
    //     };
    // };

    // private func setTimer(delayNanos : Nat64, recurring : Bool, job : () -> async ()) : (id : Nat) { 0 };
    // private func cancelTimer(id : Nat) : () {};

    // private func monitorCycles() : async () {
    //     let self : Principal = Principal.fromActor(this);
    //     let status = await ic.canister_status({ canister_id = self });
    //     // let value = {
    //     //     canister with cycles = status.cycles;
    //     //     idleCyclesBurnedPerDay = status.idle_cycles_burned_per_day;
    //     //     freezingThreshold = status.settings.freezing_threshold;
    //     //     freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
    //     //     lastChecked = now;
    //     // };
    //     ();
    // };

    public shared ({ caller }) func uploadChunk(chunk : Chunk) : async ({ chunkId : Nat }) {
        if (Principal.notEqual(caller, owner)) {
            throw Error.reject("User does not have the permission to a upload any chunks of content.");
        };

        switch (batches.get(chunk.batchId)) {
            case null throw Error.reject("Batch not found.");
            case (?batch) {
                // Extend batch timeout
                batches.put(chunk.batchId, { batch with expiresAt = Time.now() + BATCH_EXPIRY_NANOS });
                nextChunkID := nextChunkID + 1;
                chunks.put(nextChunkID, chunk);

                return { chunkId = nextChunkID };
            };
        };
    };

    public shared ({ caller }) func commitUpload({ batchId; chunkIds; headers } : { batchId : Nat; headers : [HeaderField]; chunkIds : [Nat] }) : async () {
        if (Principal.notEqual(caller, owner)) {
            throw Error.reject("User does not have the permission to commit an upload.");
        };

        let ?batch = batches.get(batchId) else throw Error.reject("No batch to commit.");
        switch (await commitChunks({ batchId; batch; chunkIds; headers })) {
            case (#err message) throw Error.reject(message);
            case (#ok) {};
        };
    };

    func clearBatch({ batchId : Nat; chunkIds : [Nat] } : { batchId : Nat; chunkIds : [Nat] }) : () {
        for (chunkId in chunkIds.vals()) {
            chunks.delete(chunkId);
        };

        batches.delete(batchId);
    };

    func clearExpiredBatches() : () {
        let now : Time.Time = Time.now();

        // Remove expired batches
        for ((batchId : Nat, batch : Batch) in batches.entries()) {
            if (now > batch.expiresAt) {
                batches.delete(batchId);
            };
        };

        // Remove chunk without existing batches (those we just deleted above)
        for ((chunkId : Nat, chunk : Chunk) in chunks.entries()) {
            if (Option.isNull(batches.get(chunk.batchId))) {
                chunks.delete(chunkId);
            };
        };
    };

    func commitChunks({ batchId; batch; chunkIds; headers } : { batchId : Nat; batch : Batch; headers : [HeaderField]; chunkIds : [Nat] }) : async Result.Result<(), Text> {
        // Test batch is not expired
        let now : Time.Time = Time.now();
        if (now > batch.expiresAt) {
            clearExpiredBatches();
            return #err "Batch did not complete in time. Chunks cannot be commited.";
        };

        let contentChunks : Buffer.Buffer<Blob> = Buffer.Buffer(1);

        for (chunkId in chunkIds.vals()) {
            let chunk : ?Chunk = chunks.get(chunkId);

            switch (chunk) {
                case (?chunk) {
                    if (Nat.notEqual(batchId, chunk.batchId)) {
                        return #err "Chunk not included in the provided batch";
                    };

                    contentChunks.add(chunk.content);
                };
                case null {
                    return #err "Chunk does not exist.";
                };
            };
        };

        if (contentChunks.size() <= 0) {
            return #err "No chunk to commit.";
        };

        var totalLength = 0;
        for (chunk in contentChunks.vals()) {
            totalLength += chunk.size();
        };

        let asset = {
            key = batch.key;
            headers;
            encoding = {
                modified = Time.now();
                contentChunks = Buffer.toArray(contentChunks);
                totalLength;
            };
        };

        switch (await journal.addFile({ id = batch.key.id; bucketId = Principal.fromActor(this); name = batch.key.name; fileSize = batch.key.fileSize; parentId = batch.key.parentId })) {
            case (#err message) {
                return #err "message";
            };
            case (#ok _) {
                assets := Trie.put<Text, Asset>(assets, Utils.keyText(batch.key.id), Text.equal, asset).0;
                clearBatch({ batchId; chunkIds });
                #ok();
            };
        };
    };

    public shared ({ caller }) func getUsedMemorySize() : async Nat {
        if (Principal.notEqual(caller, installer)) {
            throw Error.reject("User does not have the permission to get the size of stable memory.");
        };

        let stableVarInfo = StableMemory.stableVarQuery();
        let { size } = await stableVarInfo();

        let reservedMemory : Nat = do {
            var size : Nat = 0;
            for ({ key } in batches.vals()) {
                size += key.fileSize;
            };
            size;
        };

        Nat64.toNat(size) + reservedMemory;
    };

    let version = "v4";

    public query ({ caller }) func getVersion() : async Text {
        version;
    };

    // system func timer(set : Nat64 -> ()) : async () {
    //     set(Nat64.fromIntWrap(Time.now()) + 20_000_000_000); // 20 seconds from now
    //     ignore checkBalance();
    // };

    // private func checkBalance() : async () {
    //     try {
    //         let self = Principal.fromActor(this);
    //         let status = await ic.canister_status({ canister_id = self });
    //         let freezingThresholdInCycles = status.memory_size * status.settings.freezing_threshold * 127000 / 1073741824;
    //         let availableCycles = Nat.sub(status.cycles, freezingThresholdInCycles);
    //         let amount : Nat = Nat.max(CYCLE_THRESHOLD, status.idle_cycles_burned_per_day * 10);
    //         Debug.print("[Storage] AfterCheck " # debug_show ({ cycles = status.cycles; availableCycles }));
    //         if (availableCycles <= amount) {
    //             Debug.print("[Storage] EnqueueTopUp " # debug_show ({ canisterId = self }));
    //             ignore journal.topupCanister({ canisterId = self; amount });
    //         };
    //     } catch (err) {
    //         Debug.print("[Storage] AfterCheck " # Error.message(err));
    //     };
    // };
};
