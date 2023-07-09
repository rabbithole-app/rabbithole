import { arrayBufferToUint8Array, toNullable } from '@dfinity/utils';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { createHash } from 'node:crypto';
import { defer, filter, from, last, map, mergeMap, range, repeat, scan, share, skip, switchMap, take, takeUntil } from 'rxjs';
import { createStream } from 'table';
import { v4 as uuidv4 } from 'uuid';
import { storageActorLocal } from './actors/storage.actors.mjs';
import { getLocalHttpAgent } from './utils/agent.utils.mjs';

const CONCURRENT_CHUNKS_COUNT = 10;
const CHUNK_SIZE = 1024 * 1024;
const reinstallBefore = true;

function getAssetsTotalSize(canister) {
    try {
        let res = execSync(`dfx canister call ${canister} getAssetsTotalSize`);
        return formatMemorySize(parseInt(res.toString().trim().match(/\d/g).join('')));
    } catch (e) {
        console.error(e.message);
        return 'err';
    }
}

function getStableMemorySize(canister) {
    try {
        let res = execSync(`dfx canister call ${canister} getStableMemorySize`);
        return formatMemorySize(parseInt(res.toString().trim().match(/\d/g).join('')));
    } catch (e) {
        console.error(e.message);
        return 'err';
    }
}

function getHeapSize(canister) {
    try {
        let res = execSync(`dfx canister call ${canister} getHeapSize`);
        return formatMemorySize(parseInt(res.toString().trim().match(/\d/g).join('')));
    } catch (e) {
        console.error(e.message);
        return 'err';
    }
}

function getMaxLiveSize(canister) {
    try {
        let res = execSync(`dfx canister call ${canister} getMaxLiveSize`);
        return formatMemorySize(parseInt(res.toString().trim().match(/\d/g).join('')));
    } catch (e) {
        console.error(e.message);
        return 'err';
    }
}

function getMemorySize(canister) {
    try {
        let res = execSync(`dfx canister call ${canister} getMemorySize`);
        return formatMemorySize(parseInt(res.toString().trim().match(/\d/g).join('')));
    } catch (e) {
        console.error(e.message);
        return 'err';
    }
}

function formatMemorySize(size) {
    return `${(size / 1024 / 1024).toFixed(2)} mb`;
}

function upgrade(canister, owner) {
    try {
        execSync(`DFX_MOC_PATH="$(vessel bin)/moc" dfx deploy ${canister} --upgrade-unchanged --argument '(principal "${owner}")'`, { stdio: 'pipe' });
        return true;
    } catch (e) {
        console.error(e.message);
        return false;
    }
}

function stop(canister) {
    try {
        execSync(`DFX_MOC_PATH="$(vessel bin)/moc" dfx canister stop ${canister}`, { stdio: 'pipe' });
        return true;
    } catch (e) {
        console.error(e.message);
        return false;
    }
}

function start(canister) {
    try {
        execSync(`DFX_MOC_PATH="$(vessel bin)/moc" dfx canister start ${canister}`, { stdio: 'pipe' });
        return true;
    } catch (e) {
        console.error(e.message);
        return false;
    }
}

async function reinstall(canister) {
    const agent = await getLocalHttpAgent();
    const principal = await agent.getPrincipal();
    execSync(`DFX_MOC_PATH="$(vessel bin)/moc" dfx deploy ${canister} --argument '(principal "${principal.toText()}")' --mode reinstall --yes`, {
        stdio: 'pipe'
    });
}

function uploadFile(actor, item) {
    const assetKey = {
        id: item.id,
        name: item.name,
        parentId: toNullable(item.parentId),
        fileSize: BigInt(item.fileSize),
        sha256: toNullable(item.sha256),
        ecrypted: false
    };
    const chunkCount = Math.ceil(item.fileSize / CHUNK_SIZE);
    return from(actor.initUpload(assetKey)).pipe(
        switchMap(({ batchId }) =>
            range(0, chunkCount).pipe(
                mergeMap(index => {
                    const startByte = index * CHUNK_SIZE;
                    const endByte = Math.min(item.fileSize, startByte + CHUNK_SIZE);
                    const chunk = item.data.slice(startByte, endByte);
                    return from(
                        actor.uploadChunk({
                            batchId,
                            content: arrayBufferToUint8Array(chunk),
                            sha256: createHash('sha256').update(chunk).digest()
                        })
                    ).pipe(map(({ chunkId }) => ({ chunkSize: chunk.byteLength, chunkId, index })));
                }, CONCURRENT_CHUNKS_COUNT),
                scan(
                    (acc, next) => {
                        acc.chunkIds[next.index] = next.chunkId;
                        const loaded = acc.loaded + next.chunkSize;
                        const progress = Math.ceil((loaded / item.fileSize) * 100);
                        return { ...acc, loaded, progress };
                    },
                    { batchId, loaded: 0, progress: 0, chunkIds: Array.from({ length: chunkCount }).fill(null), status: 'processing' }
                )
            )
        ),
        last(),
        switchMap(({ chunkIds, batchId }) =>
            actor.commitUpload(
                {
                    batchId,
                    chunkIds,
                    headers: [
                        ['Content-Type', item.contentType],
                        ['accept-ranges', 'bytes']
                    ]
                },
                false
            )
        )
    );
}

async function main() {
    const canister = 'storage';
    const canisterId = execSync(`dfx canister id ${canister}`).toString().trim();
    const actor = await storageActorLocal(canisterId);
    const agent = await getLocalHttpAgent();
    const principal = await agent.getPrincipal();
    const owner = principal.toText();
    const stream = createStream({
        columnDefault: {
            width: 10
        },
        columns: [
            { alignment: 'center', width: 5 },
            { alignment: 'right' },
            { alignment: 'right', width: 13 },
            { alignment: 'right' },
            { alignment: 'right' },
            { alignment: 'right' },
            { alignment: 'center', width: 19 },
            { alignment: 'right', width: 16 },
            { alignment: 'right', width: 20 },
            { alignment: 'right', width: 16 },
            { alignment: 'right', width: 18 }
        ],
        columnCount: 11
    });
    if (reinstallBefore) {
        console.log('Reinstalling...');
        await reinstall(canister);
        console.log('Reinstalled');
    }
    stream.write([
        'index',
        'uploaded',
        'stable memory',
        'max live',
        'heap',
        'memory',
        'upgrade successfull',
        'upgrade ex. time',
        'max live postupgrade',
        'heap postupgrade',
        'memory postupgrade'
    ]);
    let index = 0;
    const upload$ = defer(() => {
        const data = readFileSync('./scripts/test.pdf', { flag: 'r' });
        const sha256 = createHash('sha256').update(data).digest();
        const item = {
            id: uuidv4(),
            name: 'test.pdf',
            fileSize: data.length,
            contentType: 'application/pdf',
            data,
            sha256
        };

        return uploadFile(actor, item).pipe(
            map(() => {
                const totalUploaded = getAssetsTotalSize(canister);
                const stableMemory = getStableMemorySize(canister);
                const maxLive = getMaxLiveSize(canister);
                const heap = getHeapSize(canister);
                const memory = getMemorySize(canister);
                const start = performance.now();
                const upgraded = upgrade(canister, owner);
                const end = performance.now();
                const upgradeTime = `${((end - start) / 1000).toFixed(2)}s`;
                const maxLivePostupgrade = getMaxLiveSize(canister);
                const heapPostupgrade = getHeapSize(canister);
                const memoryPostupgrade = getMemorySize(canister);
                return [
                    index,
                    totalUploaded,
                    stableMemory,
                    maxLive,
                    heap,
                    memory,
                    upgraded,
                    upgradeTime,
                    maxLivePostupgrade,
                    heapPostupgrade,
                    memoryPostupgrade
                ];
            })
        );
    }).pipe(repeat(), share());
    const off$ = upload$.pipe(
        filter(row => !row[5]),
        skip(1)
    );
    upload$.pipe(takeUntil(off$) /*take(1), */).subscribe(row => {
        stream.write(row);
        index += 1;
    });
}

main();
