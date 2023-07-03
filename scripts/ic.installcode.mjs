#!/usr/bin/env node

import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
import { Command, InvalidArgumentError, Option } from 'commander';
import { Listr } from 'listr2';
import { Observable, concat, concatMap, defer, from, map, range, switchMap } from 'rxjs';
import { journalActorIC, journalActorLocal } from './actors/journal.actors.mjs';
import { rabbitholeActorIC, rabbitholeActorLocal } from './actors/rabbithole.actors.mjs';
import { loadWasm } from './utils/code.utils.mjs';

const program = new Command();
program
    .addOption(new Option('-l, --list', 'Show only the list of canisters').default(false).conflicts(['concurrent']))
    .addOption(new Option('--canister-id <canisterId>', 'Install code to specific canister id').conflicts(['concurrent']).argParser(parsePrincipal))
    .addOption(
        new Option('-t, --type <type>', 'User canister type. By default, the type of canisters is journal').default('journal').choices(['journal', 'storage'])
    )
    .addOption(
        new Option('-m, --mode <mode>', 'Specifies the type of deployment. You can set the canister deployment modes to install, reinstall, or upgrade.')
            .default('upgrade')
            .choices(['upgrade', 'install', 'reinstall'])
    )
    .addOption(
        new Option('-n, --network <network>', 'Overrides the environment to connect to. By default, the local canister execution environment is used.')
            .default('local')
            .choices(['local', 'ic'])
    )
    .addOption(
        new Option('-c, --concurrent <number>', 'Maximum number of concurrent canister upgrade requests. By default, all requests run at the same time.')
            .default(Infinity)
            .argParser(myParseInt)
    );

program.parse(process.argv);

function parsePrincipal(principal) {
    try {
        Principal.fromText(principal);
        return principal;
    } catch (_) {
        throw new InvalidArgumentError('Not a principal.');
    }
}

function myParseInt(value) {
    // parseInt takes a string and a radix
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        throw new InvalidArgumentError('Not a number.');
    }

    return parsedValue;
}

(async () => {
    const opts = program.opts();
    const tasks = new Listr([
        {
            title: `Create actor: ${opts.network}`,
            task: async ctx => {
                ctx.actor = opts.network === 'ic' ? await rabbitholeActorIC() : await rabbitholeActorLocal();
            }
        },
        {
            title: 'Get list of journal canisters',
            task: async (ctx, task) => {
                ctx.list = await ctx.actor.listBuckets('journal');

                if (opts.canisterId) {
                    ctx.list = ctx.list.filter(([_, bucketId]) => bucketId.toText() === opts.canisterId);
                }
                if (opts.list) {
                    return task.newListr(
                        ctx.list.map(([_, bucketId]) => ({ title: bucketId.toText(), task: () => {} })),
                        { rendererOptions: { collapseSubtasks: false } }
                    );
                }
            }
        },
        {
            title: 'Load wasm module',
            enabled: () => !opts.list,
            task: async ctx => {
                const wasmModule = await loadWasm(opts.type);
                ctx.wasmModule = wasmModule;
            }
        },
        {
            title: `Upgrading canisters`,
            skip: ctx => {
                if (ctx.list.length === 0) {
                    return 'No buckets found.';
                }
            },
            enabled: () => opts.type === 'storage' && !opts.list,
            task: (ctx, task) =>
                task.newListr(
                    ctx.list.map(([_, bucketId]) => ({
                        title: bucketId.toText(),
                        task: () =>
                            new Observable(subscriber => {
                                subscriber.next('Create actor');
                                const subscription = from(opts.network === 'ic' ? journalActorIC(bucketId) : journalActorLocal(bucketId))
                                    .pipe(
                                        switchMap(actor => {
                                            const chunkSize = 700000;
                                            const resetWasm$ = defer(() => {
                                                subscriber.next('Reset wasm module');
                                                return actor.storageResetWasm();
                                            });
                                            const uploadWasm$ = range(0, Math.ceil(ctx.wasmModule.length / chunkSize)).pipe(
                                                concatMap(index => {
                                                    const start = index * chunkSize;
                                                    const end = Math.min(start + chunkSize, ctx.wasmModule.length);
                                                    const chunks = ctx.wasmModule.slice(start, end);
                                                    if (start === 0) {
                                                        subscriber.next('Uploading wasm module');
                                                    }

                                                    return from(actor.storageLoadWasm(chunks)).pipe(
                                                        map(result => `Uploading wasm module: ${result.total}/${ctx.wasmModule.length}`)
                                                    );
                                                })
                                            );
                                            const upgrade$ = defer(() => {
                                                subscriber.next('Upgrade storages');
                                                return actor.upgradeStorages();
                                            });
                                            return concat(resetWasm$, uploadWasm$, upgrade$);
                                        })
                                    )
                                    .subscribe(subscriber);
                                return () => subscription.unsubscribe();
                            })
                    })),
                    { concurrent: opts.concurrent, exitOnError: false, rendererOptions: { collapseSubtasks: false } }
                )
        },
        {
            title: `Upgrading canisters`,
            skip: ctx => {
                if (ctx.list.length === 0) {
                    return 'No buckets found.';
                }
            },
            enabled: () => opts.type === 'journal' && !opts.list,
            task: async (ctx, task) =>
                task.newListr(
                    ctx.list.map(([owner, bucketId]) => ({
                        title: bucketId.toText(),
                        task: () =>
                            defer(() => {
                                const arg = IDL.encode([IDL.Principal], [owner]);
                                return from(
                                    ctx.actor.installCode({
                                        canister_id: bucketId,
                                        arg: [...arg],
                                        wasm_module: ctx.wasmModule,
                                        mode: { [opts.mode]: null }
                                    })
                                );
                            })
                    })),
                    { concurrent: opts.concurrent, exitOnError: false, rendererOptions: { collapseSubtasks: false } }
                )
        }
    ]);

    await tasks.run().catch(e => {});
})();
