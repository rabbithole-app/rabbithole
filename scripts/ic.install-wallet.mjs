#!/usr/bin/env node

import { Command, Option } from 'commander';
import { Listr } from 'listr2';
import { from, range } from 'rxjs';
import { concatMap, map, tap } from 'rxjs/operators';
import { rabbitholeActorIC, rabbitholeActorLocal } from './actors/rabbithole.actors.mjs';
import { loadWasm } from './utils/code.utils.mjs';

const program = new Command();
program.addOption(
    new Option('-n, --network <network>', 'Overrides the environment to connect to. By default, the local canister execution environment is used.')
        .default('local')
        .choices(['local', 'ic'])
);

program.parse(process.argv);

(async () => {
    const opts = program.opts();
    const tasks = new Listr([
        {
            title: `Create actor: ${opts.network}`,
            task: async ctx => {
                ctx.actor = await (opts.network === 'ic' ? rabbitholeActorIC() : rabbitholeActorLocal());
            }
        },
        {
            title: 'Reset wasm module',
            task: ctx => ctx.actor.walletResetWasm()
        },
        {
            title: 'Load wasm module',
            task: async ctx => {
                const wasmModule = await loadWasm('wallet', 'local');
                ctx.wasmModule = wasmModule;
            }
        },
        {
            title: 'Installing wasm code in manager',
            task: (ctx, task) => {
                const chunkSize = 700000;
                return range(0, Math.ceil(ctx.wasmModule.length / chunkSize)).pipe(
                    concatMap(index => {
                        const start = index * chunkSize;
                        const end = Math.min(start + chunkSize, ctx.wasmModule.length);
                        const chunks = ctx.wasmModule.slice(start, end);
                        return from(ctx.actor.walletLoadWasm(chunks)).pipe(map(result => `Chunks: ${result.total}/${ctx.wasmModule.length}`));
                    }),
                    tap({
                        complete: () => (task.title = 'Installation cycles-wallet done')
                    })
                );
            }
        }
    ]);

    await tasks.run().catch(e => {});
})();
