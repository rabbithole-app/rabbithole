import { formatDuration } from 'date-fns';
import { CanisterStatus, CanisterStatusFormatted } from '../models';
import { CanisterStatusResponse } from '@dfinity/ic-management';
import { formatTCycles } from '@features/wallet/utils';
import { formatBytes } from '@features/file-list/utils';
import { fromNullable } from '@dfinity/utils';

export function formatFreezingThreshold(_seconds: bigint) {
    let seconds = Number(_seconds);
    const duration: Duration = {};
    const time: Record<keyof Duration, number> = { years: 31536000, months: 2592000, weeks: 604800, days: 86400, hours: 3600, minutes: 60, seconds: 1 };

    for (const key in time) {
        const period = key as keyof Duration;
        if (seconds >= time[period]) {
            duration[period] = Math.floor(seconds / time[period]);
            seconds = seconds % time[period];
        }
    }

    return formatDuration(duration);
}

export const toStatus = (status: { stopped: null } | { stopping: null } | { running: null }): CanisterStatus =>
    'stopped' in status && status.stopped === null ? 'stopped' : 'stopping' in status && status.stopping === null ? 'stopping' : 'running';

export function formatCanisterStatus(status: CanisterStatusResponse): CanisterStatusFormatted {
    const freezingThresholdInCycles = formatTCycles(BigInt((Number(status.idle_cycles_burned_per_day) / 86400) * Number(status.settings.freezing_threshold)));
    const moduleHash = fromNullable(status.module_hash);
    return {
        cycles: formatTCycles(status.cycles),
        freezingThresholdInCycles,
        memorySize: formatBytes(Number(status.memory_size)),
        settings: {
            freezingThreshold: formatFreezingThreshold(status.settings.freezing_threshold),
            status: toStatus(status.status),
            controllers: status.settings.controllers.map(value => value.toText())
        },
        moduleHash: moduleHash ? Buffer.from(moduleHash).toString('hex') : undefined
    };
}
