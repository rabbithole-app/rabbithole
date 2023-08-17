import StableMemory "mo:base/ExperimentalStableMemory";
import Result "mo:base/Result";
import Types "../types/types";
import StorageTypes "types";
import HTTP "../types/http";
import JournalTypes "../journal/types";
import Utils "../utils/utils";
import Blob "mo:base/Blob";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Error "mo:base/Error";
import Nat32 "mo:base/Nat32";
import { recurringTimer; cancelTimer } "mo:base/Timer";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Map "mo:hashmap/Map";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";
import Prelude "mo:base/Prelude";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import TrieSet "mo:base/TrieSet";
import CRC32 "mo:hash/CRC32";
import Option "mo:base/Option";
import Text "mo:base/Text";
import Nat8 "mo:base/Nat8";
import Nat64 "mo:base/Nat64";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Prim "mo:prim";
import Trie "mo:base/Trie";

import CBOR "mo:cbor/Decoder";
import CertTree "mo:ic-certification/CertTree";
import ReqData "mo:ic-certification/ReqData";
import CanisterSigs "mo:ic-certification/CanisterSigs";
import MerkleTree "mo:ic-certification/MerkleTree";
import CertifiedData "mo:base/CertifiedData";
import Hex "mo:encoding/Hex";
import Memory "mo:stableBTree/memory";
import MemoryManager "mo:stableBTree/memoryManager";
import StableBTree "mo:stableBTree/btreemap";
import StableBTreeTypes "mo:stableBTree/types";
import BytesConverter "mo:stableBTree/bytesConverter";
import { nat32ToBytes; bytesToNat32; boolToBytes; bytesToBool } = "mo:stableBTree/conversion";
import Vector "mo:vector";

shared ({ caller = installer }) actor class Storage(owner : Principal) = this {
    type ID = Types.ID;
    type Asset = StorageTypes.Asset;
    type AssetKey = StorageTypes.AssetKey;
    type AssetEncoding = StorageTypes.AssetEncoding;
    type Chunk = StorageTypes.Chunk;
    type ChunkV2 = StorageTypes.ChunkV2;
    type Batch = StorageTypes.Batch;
    type CommitBatch = StorageTypes.CommitBatch;
    type UploadChunk = StorageTypes.UploadChunk;
    type InitUpload = StorageTypes.InitUpload;
    type CommitUploadError = StorageTypes.CommitUploadError;
    type HttpRequest = HTTP.HttpRequest;
    type HttpResponse = HTTP.HttpResponse;
    type HeaderField = HTTP.HeaderField;
    type StreamingCallbackHttpResponse = HTTP.StreamingCallbackHttpResponse;
    type StreamingCallbackToken = HTTP.StreamingCallbackToken;
    type StreamingStrategy = HTTP.StreamingStrategy;

    let VERSION : Nat = 4;
    let BATCH_EXPIRY_NANOS = 300_000_000_000; // 5 minutes
    // let CLEAR_EXPIRED_BATCHES_INTERVAL_SECONDS : Nat = 3600; // 1 hour

    var nextBatchID : Nat = 0;
    var nextChunkID : Nat32 = 0;

    let { nhash; thash } = Map;
    stable var assets : Trie.Trie<ID, Asset> = Trie.empty();
    var batches : Map.Map<Nat, Batch> = Map.new<Nat, Batch>(nhash);
    var chunks : Map.Map<Nat, Chunk> = Map.new<Nat, Chunk>(nhash);
    let journal : JournalTypes.Self = actor (Principal.toText(installer));
    // let hashesQueue : Queue.Queue<{ chunkId : Nat }> = Queue.Queue<{}>();

    let CHUNK_MAX_SIZE : Nat = 1024 * 1536; // 1.5mb
    let chunksV2 = StableBTree.init<Nat32, ChunkV2>(
		Memory.STABLE_MEMORY,
		BytesConverter.NAT32_CONVERTER,
		{
            fromBytes = func (arr : [Nat8]) {
                let buffers = Buffer.fromArray<Nat8>(arr) |> Buffer.split(_, 9);
                let batchId = Buffer.subBuffer(buffers.0, 0, 4) |> Buffer.toArray _ |> bytesToNat32 _ |> Nat32.toNat _;
                let size = Buffer.subBuffer(buffers.0, 4, 4) |> Buffer.toArray _ |> bytesToNat32 _ |> Nat32.toNat _;
                let encrypted = buffers.0.get(8) |> bytesToBool([_ : Nat8]);
                let content = Buffer.toArray(buffers.1) |> Blob.fromArray _;
                { batchId; size; content; encrypted };
            };
            toBytes = func ({ batchId; size; content; encrypted } : ChunkV2) {
                let buffer = Buffer.Buffer<Nat8>(4 + 4 + 1 + size);
                buffer.insertBuffer(0, Buffer.fromArray(nat32ToBytes(Nat32.fromNat(batchId))));
                buffer.insertBuffer(4, Buffer.fromArray(nat32ToBytes(Nat32.fromNat(size))));
                buffer.insert(8, if encrypted 1:Nat8 else 0:Nat8);
                buffer.insertBuffer(9, Buffer.fromArray<Nat8>(Blob.toArray(content)));
                Buffer.toArray(buffer);
            };
            maxSize = func () : Nat32 { Nat32.fromNat(CHUNK_MAX_SIZE); };
        }
	);

    stable let certStore : CertTree.Store = CertTree.newStore();
    let ct = CertTree.Ops(certStore);
    let csm = CanisterSigs.Manager(ct, null);

    public query func getCertTree() : async MerkleTree.RawTree {
        MerkleTree.structure(certStore.tree);
    };

    public query func version() : async Nat { VERSION };

    /**
     * HTTP
     */

    public query ({ caller }) func http_request({ method : Text; url : Text } : HttpRequest) : async HttpResponse {
        try {
            if (Text.notEqual(method, "GET")) {
                return {
                    body = Text.encodeUtf8("Method Not Allowed.");
                    headers = getHeaders(null);
                    status_code = 405;
                    streaming_strategy = null;
                };
            };

            let #ok((asset, _chunkId)) = getAssetByURL(url) else return {
                body = Text.encodeUtf8("Permission denied. Could not perform this operation.");
                headers = getHeaders(null);
                status_code = 403;
                streaming_strategy = null;
            };
            let chunkId = Option.get(_chunkId, asset.encoding.chunkIds[0]);
            let ?{ content; encrypted; size } : ?ChunkV2 = chunksV2.get(chunkId) else return {
                body = Text.encodeUtf8("Chunk not found.");
                headers = getHeaders(null);
                status_code = 404;
                streaming_strategy = null;
            };

            switch (_chunkId, encrypted) {
                case (?id, _) {
                    {
                        body = content;
                        headers = getHeaders(?{ asset with encoding = { asset.encoding with totalLength = size } });
                        status_code = 200;
                        streaming_strategy = null;
                    };
                };
                case (null, true) {
                    {
                        body = Text.encodeUtf8("Chunks are encrypted. Merging of encrypted data is not possible.");
                        headers = getHeaders(null);
                        status_code = 412;
                        streaming_strategy = null;
                    };
                };
                case (null, _) {
                    {
                        body = content;
                        headers = getHeaders(?asset);
                        status_code = 200;
                        streaming_strategy = createStrategy(asset);
                    };
                };
            }
        } catch (err) {
            return {
                body = Text.encodeUtf8("Unexpected error: " # Error.message(err));
                headers = getHeaders(null);
                status_code = 500;
                streaming_strategy = null;
            };
        };
    };

    public query ({ caller }) func http_request_streaming_callback(streamingToken : StreamingCallbackToken) : async StreamingCallbackHttpResponse {
        let #ok(asset) = getAsset(streamingToken.id) else throw Error.reject("Streamed asset not found");
        let chunkId = asset.encoding.chunkIds[streamingToken.index];
        let ?{ content } = chunksV2.get(chunkId) else throw Error.reject("Chunk not found");
        let token : ?StreamingCallbackToken = createToken(asset, streamingToken.index);
        { token; body = content };
    };

    public query func getChunks(id : ID) : async Result.Result<AssetEncoding, { #notFound }> {
        let #ok(asset) = getAsset(id) else return #err(#notFound);
        #ok(asset.encoding);
    };

    public query func listChunks() : async [Nat32] {
        let buffer = Buffer.Buffer<Nat32>(0);
        for ((chunkId, _) in chunksV2.iter()) {
            buffer.add(chunkId);
        };
        Buffer.toArray(buffer);
    };

    public query func list() : async [(ID, Asset)] {
        Trie.iter(assets) |> Iter.toArray _;
    };

    func getAssetByURL(url : Text) : Result.Result<(Asset, ?Nat32), { #noUrl; #notFound }> {
        if (Text.size(url) == 0) {
            return #err(#noUrl);
        };

        let segments = Text.trimStart(url, #char '/') |> Text.split(_, #char '/') |> Iter.toArray _;
        var chunkId : ?Nat32 = null;
        if (segments.size() > 1) chunkId := Option.map<Nat, Nat32>(Nat.fromText(segments[1]), Nat32.fromNat);
        let #ok(asset) = getAsset(segments[0]) else return #err(#notFound);
        #ok((asset, chunkId));
    };

    func getAsset(id : ID) : Result.Result<Asset, { #notFound }> {
        let ?asset = Trie.get(assets, Utils.keyText(id), Text.equal) else return #err(#notFound);
        #ok asset;
    };

    func createStrategy(asset : Asset) : ?StreamingStrategy {
        let streamingToken : ?StreamingCallbackToken = createToken(asset, 0);

        switch (streamingToken) {
            case null null;
            case (?streamingToken) {
                // Hack: https://forum.dfinity.org/t/cryptic-error-from-icx-proxy/6944/8
                // Issue: https://github.com/dfinity/candid/issues/273

                let self : Principal = Principal.fromActor(this);
                let canisterId : Text = Principal.toText(self);

                let canister = actor (canisterId) : actor {
                    http_request_streaming_callback : query StreamingCallbackToken -> async StreamingCallbackHttpResponse;
                };

                ? #Callback({
                    token = streamingToken;
                    callback = canister.http_request_streaming_callback;
                });
            };
        };
    };

    func createToken({ id; key; encoding; headers } : Asset, chunkIndex : Nat) : ?StreamingCallbackToken {
        let index = chunkIndex + 1;
        if (index >= encoding.chunkIds.size()) {
            return null;
        };

        let streamingToken : ?StreamingCallbackToken = ?{
            id;
            headers;
            index;
            sha256 = key.sha256;
        };
        streamingToken;
    };

    /**
     * Upload
     */

    public shared ({ caller }) func initUpload(key : AssetKey) : async InitUpload {
        if (Principal.notEqual(caller, owner)) {
            throw Error.reject("User does not have the permission to upload data. Caller: " # Principal.toText(caller));
        };

        // let exists = label v : Bool {
        //     for ((id, asset) in Trie.iter<ID, Asset>(assets)) {
        //         switch (key.sha256, asset.key.sha256) {
        //             case (?h1, ?h2) if (Array.equal(h1, h2, Nat8.equal)) break v true;
        //             case _ {};
        //         };
        //     };
        //     false;
        // };
        // if (exists) {
        //     throw Error.reject("Asset already exists.");
        // };

        nextBatchID := Nat.add(nextBatchID, 1);
        let now : Time.Time = Time.now();
        clearExpiredBatches();
        Map.set(batches, nhash, nextBatchID, { key; expiresAt = now + BATCH_EXPIRY_NANOS; chunkIds = [] });
        { batchId = nextBatchID };
    };

    public shared ({ caller }) func batchAlive(id : Nat) : async () {
        if (Principal.notEqual(caller, owner)) {
            throw Error.reject("User does not have the permission to keep batch alive.");
        };

        let ?batch : ?Batch = Map.get(batches, nhash, id) else throw Error.reject("Batch not found.");
        ignore Map.put(batches, nhash, id, { batch with expiresAt = Time.now() + BATCH_EXPIRY_NANOS });
    };

    public shared ({ caller }) func uploadChunk(chunk : Chunk) : async UploadChunk {
        if (Principal.notEqual(caller, owner)) {
            throw Error.reject("User does not have the permission to a upload any chunks of content.");
        };

        let ?batch : ?Batch = Map.get(batches, nhash, chunk.batchId) else throw Error.reject("Batch not found.");
        nextChunkID := nextChunkID + 1;
        let result = chunksV2.insert(nextChunkID, { chunk and { size = chunk.content.size() } } );
        Debug.print(debug_show(result));
        switch (result) {
            case (#err(#KeyTooLarge { given; max })) throw Error.reject("Insert error: key too large, given " # Nat.toText(given) # ", max " # Nat.toText(max));
            case (#err(#ValueTooLarge { given; max })) throw Error.reject("Insert error: value too large, given " # Nat.toText(given) # ", max " # Nat.toText(max));
            case _ {
                // let chunkId = Nat32.toNat(nextChunkID);
                let chunkIds = do {
                    let buffer = Buffer.fromArray<Nat32>(batch.chunkIds);
                    buffer.add(nextChunkID);
                    Buffer.toArray(buffer);
                };
                let updatedBatch : Batch = { batch with expiresAt = Time.now() + BATCH_EXPIRY_NANOS; chunkIds };
                ignore Map.put(batches, nhash, chunk.batchId, updatedBatch);
                { chunkId = nextChunkID };
            };
        };
    };

    public shared ({ caller }) func commitUpload({ batchId; chunkIds; headers } : CommitBatch, notifyJournal : Bool) : async Result.Result<(), CommitUploadError> {
        if (Principal.notEqual(caller, owner)) {
            throw Error.reject("User does not have the permission to commit an upload.");
        };

        let ?batch = Map.get(batches, nhash, batchId) else return #err(#batchNotFound);
        // Test batch is not expired
        let now : Time.Time = Time.now();
        if (now > batch.expiresAt) {
            clearExpiredBatches();
            return #err(#batchExpired);
        };

        var totalLength = 0;
        for (chunkId in chunkIds.vals()) {
            let ?chunk : ?ChunkV2 = chunksV2.get(chunkId) else return #err(#chunkNotFound chunkId);

            if (Nat.notEqual(batchId, chunk.batchId)) {
                return #err(#chunkWrongBatch chunkId);
            };

            totalLength += chunk.size;
        };

        if (Nat.equal(totalLength, 0)) {
            return #err(#empty);
        };

        let id : ID = batch.key.id;
        let asset : Asset = {
            id;
            key = batch.key;
            headers;
            encoding = {
                modified = Time.now();
                chunkIds;
                totalLength;
            };
        };

        if (notifyJournal) {
            let file = { { batch.key with id } and { bucketId = Principal.fromActor(this) } };
            switch (await journal.addFile(file)) {
                case (#err err) {
                    return #err(#addFile err);
                };
                case (#ok _) {};
            };
        };

        switch (batch.key.sha256) {
            case (?v) {
                // insert into CertTree
                ct.put(["http_assets", Text.encodeUtf8("/" # id)], v);
                ct.setCertifiedData();
            };
            case _ {};
        };
        assets := Trie.put<ID, Asset>(assets, Utils.keyText(id), Text.equal, asset).0;
        Map.delete(batches, nhash, batchId);
        #ok();
    };

    func clearExpiredBatches() : () {
        let now : Time.Time = Time.now();
        batches := Map.mapFilter<Nat, Batch, Batch>(
            batches,
            nhash,
            func(batchId : Nat, batch : Batch) : ?Batch {
                if (now > batch.expiresAt) {
                    deleteChunks(batch.chunkIds);
                    null;
                } else ?batch;
            }
        );
    };

    public shared ({ caller }) func getUsedMemorySize() : async Nat {
        if (Principal.notEqual(caller, installer) and not Utils.isAdmin(caller)) {
            throw Error.reject("User does not have the permission to get the size of stable memory.");
        };

        let stableVarInfo = StableMemory.stableVarQuery();
        let { size } = await stableVarInfo();
        Nat64.toNat(size);
    };

    // func startBatchMonitor() : () {
    //     switch(batchTimerId) {
    //         case null batchTimerId := ?recurringTimer(#seconds CLEAR_EXPIRED_BATCHES_INTERVAL_SECONDS, clearExpiredBatches);
    //         case (?id) {};
    //     };
    // };

    // func stopBatchMonitor() : () {
    //     switch(batchTimerId) {
    //         case null {};
    //         case (?id) cancelTimer(id);
    //     };
    // };

    func deleteChunks(chunkIds : [Nat32]) : () {
        for (chunkId in chunkIds.vals()) {
            ignore chunksV2.remove(chunkId);
        };
    };

    public shared ({ caller }) func delete(id : ID) : async () {
        if (Principal.notEqual(caller, installer)) {
            throw Error.reject("User does not have the permission to delete an asset.");
        };

        // remove from CertTree
        ct.delete(["http_assets", Text.encodeUtf8("/" # id)]);
        ct.setCertifiedData();
        let (newAssets, asset) = Trie.remove<ID, Asset>(assets, Utils.keyText(id), Text.equal);
        assets := newAssets;
        switch (asset) {
            case (?{ encoding }) deleteChunks(encoding.chunkIds);
            case null {};
        };
    };

    // Source: NNS-dapp
    /// List of recommended security headers as per https://owasp.org/www-project-secure-headers/
    /// These headers enable browser security features (like limit access to platform apis and set
    /// iFrame policies, etc.).
    let securityHeaders : [HeaderField] = [
        ("X-Frame-Options", "DENY"),
        ("X-Content-Type-Options", "nosniff"),
        ("Strict-Transport-Security", "max-age=31536000; includeSubDomains"),
        // "Referrer-Policy: no-referrer" would be more strict, but breaks local dev deployment
        // same-origin is still ok from a security perspective
        ("Referrer-Policy", "same-origin")
    ];

    let defaultHeaders : [HeaderField] = [("Access-Control-Allow-Origin", "*")];

    func getHeaders(asset : ?Asset) : [HeaderField] {
        let buffer = Buffer.fromArray<HeaderField>(securityHeaders);
        let defaultHeadersBuffer = Buffer.fromArray<HeaderField>(defaultHeaders);
        buffer.append(defaultHeadersBuffer);
        defaultHeadersBuffer.clear();
        switch (asset) {
            case null buffer.add(certificationHeader("/"));
            case (?{ id; headers; key; encoding }) {
                let headersBuffer = Buffer.fromArray<HeaderField>(headers);
                buffer.append(headersBuffer);
                headersBuffer.clear();
                buffer.add(certificationHeader("/" # id));
                buffer.add(("Content-Length", Nat.toText(encoding.totalLength)));
                buffer.add(("Content-Disposition", "attachment; filename=\"" # key.name # "\""));
                buffer.add(("Cache-Control", "private, max-age=0"));
            };
        };
        let headers = Buffer.toArray(buffer);
        buffer.clear();
        headers;
    };

    /*
    The other use of the tree is when calculating the ic-certificate header. This header
    contains the certificate obtained from the system, which we just pass through,
    and a witness calculated from hash tree that reveals the hash of the current
    value of the main page.
    */

    func certificationHeader(url : Text) : HeaderField {
        let witness = ct.reveal(["http_assets", Text.encodeUtf8(url)]);
        let encoded = ct.encodeWitness(witness);
        let cert = switch (CertifiedData.getCertificate()) {
            case (?c) c;
            case null {
                // unfortunately, we cannot do
                //   throw Error.reject("getCertificate failed. Call this as a query call!")
                // here, because this function isn’t async, but we can’t make it async
                // because it is called from a query (and it would do the wrong thing) :-(
                //
                // So just return erronous data instead
                "getCertificate failed. Call this as a query call!" : Blob;
            };
        };
        ("ic-certificate", "certificate=:" # Utils.base64(cert) # ":, " # "tree=:" # Utils.base64(encoded) # ":");
    };

    public query ({ caller }) func getHeapSize() : async Nat {
        Prim.rts_heap_size();
    };

    public query ({ caller }) func getMaxLiveSize() : async Nat {
        Prim.rts_max_live_size();
    };

    public query ({ caller }) func getMemorySize() : async Nat {
        Prim.rts_memory_size();
    };

    public query ({ caller }) func getAssetsTotalSize() : async Nat {
        var size : Nat = 0;
        for ((_, asset) in Trie.iter(assets)) {
            size += asset.key.fileSize;
        };
        size;
    };

    public shared ({ caller }) func getStableMemorySize() : async Nat {
        let stableVarInfo = StableMemory.stableVarQuery();
        let { size } = await stableVarInfo();
        Nat64.toNat(size);
    };

    system func preupgrade() {
        csm.pruneAll();
    };
};
