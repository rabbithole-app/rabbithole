/// <reference lib="webworker" />

import { IdbStorage, KEY_STORAGE_DELEGATION } from '@dfinity/auth-client';
import { DelegationChain, isDelegationValid } from '@dfinity/identity';
import { Subject, bufferCount, filter, forkJoin, interval, repeat, switchMap, take, takeUntil } from 'rxjs';
import { AUTH_TIMER_INTERVAL } from '../constants';
import { createAuthClient } from '../utils';

const authTimer = new Subject<boolean>();
const on$ = authTimer.asObservable().pipe(filter(v => v));
const off$ = authTimer.asObservable().pipe(filter(v => !v));

addEventListener('message', ({ data }: MessageEvent) => {
    const { action } = data;
    console.log('auth worker:', action);
    switch (action) {
        case 'startAuthTimer':
            authTimer.next(true);
            return;
        case 'stopAuthTimer':
            authTimer.next(false);
            return;
    }
});

/**
 * If user is not authenticated - i.e. no identity or anonymous and there is no valid delegation chain, then identity is not valid
 *
 * @returns true if authenticated
 */
const checkAuthentication = async (): Promise<boolean> => {
    const authClient = await createAuthClient();
    return await authClient.isAuthenticated();
};

/**
 * If there is no delegation or if not valid, then delegation is not valid
 *
 * @returns true if delegation is valid
 */
const checkDelegationChain = async (): Promise<boolean> => {
    const idbStorage: IdbStorage = new IdbStorage();
    const delegationChain: string | null = await idbStorage.get(KEY_STORAGE_DELEGATION);

    return delegationChain !== null && isDelegationValid(DelegationChain.fromJSON(delegationChain));
};

on$.pipe(
    switchMap(() => interval(AUTH_TIMER_INTERVAL)),
    switchMap(() => forkJoin({ auth: checkAuthentication(), delegation: checkDelegationChain() })),
    filter(({ auth, delegation }) => !auth || !delegation),
    bufferCount(2),
    take(1),
    takeUntil(off$),
    repeat()
).subscribe(() => postMessage({ action: 'rabbitholeSignOutAuthTimer' }));
