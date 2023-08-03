import { Principal } from '@dfinity/principal';
import { fromNullable } from '@dfinity/utils';
import { OperatorFunction, pipe } from 'rxjs';
import { map } from 'rxjs/operators';

import { formatBytes } from '@features/file-list/utils';
import { formatTCycles } from '@features/wallet/utils';
import { canister_status_response } from 'declarations/journal/journal.did';
import { CanisterDetails, CanisterDetailsRaw, CanisterStatus } from '../models';
import { formatFreezingThreshold, toStatus } from '../utils';

export function canisterDetails(): OperatorFunction<
    {
        id: Principal;
        status: canister_status_response;
        freezingThresholdInCycles: bigint;
    },
    CanisterDetailsRaw
> {
    return pipe(
        map(
            data =>
                ({
                    id: data.id,
                    cycles: data.status.cycles,
                    freezingThresholdInCycles: data.freezingThresholdInCycles,
                    memorySize: data.status.memory_size,
                    settings: {
                        freezingThreshold: data.status.settings.freezing_threshold,
                        status: toStatus(data.status.status),
                        controllers: data.status.settings.controllers
                    },
                    moduleHash: fromNullable(data.status.module_hash)
                } as CanisterDetailsRaw)
        )
    );
}

export function formatCanisterDetails(): OperatorFunction<CanisterDetailsRaw, CanisterDetails> {
    return pipe(
        map(data => ({
            id: data.id.toText() as string,
            cycles: data.cycles,
            cyclesFormatted: formatTCycles(data.cycles),
            freezingThresholdInCycles: formatTCycles(data.freezingThresholdInCycles),
            memorySize: formatBytes(Number(data.memorySize)),
            settings: {
                freezingThreshold: formatFreezingThreshold(data.settings.freezingThreshold),
                status: data.settings.status as CanisterStatus,
                controllers: data.settings.controllers.map(value => value.toText()) as string[]
            },
            moduleHash: data.moduleHash !== undefined ? Buffer.from(data.moduleHash).toString('hex') : undefined
            // storageCost: formatTCycles(data.status.idle_cycles_burned_per_day)
        }))
    );
}
