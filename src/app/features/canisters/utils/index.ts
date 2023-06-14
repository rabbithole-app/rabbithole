import { formatDuration } from 'date-fns';
import { CanisterStatus } from '../models';

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
