/// <reference lib="webworker" />

import { RxState } from '@rx-angular/state';
import { ActorSubclass, Identity } from '@dfinity/agent';
import { fromNullable, toNullable } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';
import { EMPTY, Observable, Subject, from, merge } from 'rxjs';
import { catchError, connect, filter, first, map, switchMap, withLatestFrom, tap } from 'rxjs/operators';
import { get, has, isUndefined } from 'lodash';

import { createActor, loadIdentity } from '@core/utils';
import { canisterId as rabbitholeCanisterId, idlFactory as rabbitholeIdlFactory } from 'declarations/rabbithole';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { idlFactory as journalIdlFactory } from 'declarations/journal';
import { Directory, File, DirectoryState, DirectoryStateError, _SERVICE as JournalActor } from 'declarations/journal/journal.did';
import { toDirectoryExtended, toFileExtended } from '../utils';
import { JournalItem } from '../models';

interface State {
    identity: Identity;
    actor: ActorSubclass<RabbitholeActor>;
    journal: ActorSubclass<JournalActor>;
}

const state = new RxState<State>();
const updateJournal: Subject<string | undefined> = new Subject();

addEventListener('message', ({ data }) => {
    const { action } = data;
    switch (action) {
        case 'getJournal': {
            updateJournal.next(data.path);
            break;
        }
        default:
            break;
    }
});

function createRabbitholeActor(): Observable<ActorSubclass<RabbitholeActor>> {
    return state.select('identity').pipe(
        switchMap(identity =>
            createActor<RabbitholeActor>({
                identity,
                canisterId: rabbitholeCanisterId,
                idlFactory: rabbitholeIdlFactory,
                host: location.origin
            })
        )
    );
}

function createJournalActor(canisterId: Principal): Observable<ActorSubclass<JournalActor>> {
    return state.select('identity').pipe(
        first(),
        switchMap(identity =>
            createActor<JournalActor>({
                identity,
                canisterId,
                idlFactory: journalIdlFactory,
                host: location.origin
            })
        )
    );
}

function loadJournal(): (source$: Observable<ActorSubclass<RabbitholeActor>>) => Observable<Principal> {
    return source$ =>
        source$.pipe(
            switchMap(actor =>
                from(actor.getJournalBucket()).pipe(
                    map(optCanister => fromNullable(optCanister)),
                    filter(canisterId => !isUndefined(canisterId)),
                    map(canisterId => canisterId as NonNullable<typeof canisterId>)
                )
            )
        );
}

const identity$ = from(loadIdentity()).pipe(
    filter(identity => !isUndefined(identity)),
    map(identity => identity as NonNullable<typeof identity>)
);
state.connect('identity', identity$);

state.connect(
    createRabbitholeActor().pipe(
        connect(shared =>
            merge(
                shared.pipe(map(actor => ({ actor }))),
                shared.pipe(
                    loadJournal(),
                    switchMap(canisterId => createJournalActor(canisterId)),
                    map(journal => ({ journal }))
                )
            )
        )
    )
);

updateJournal
    .asObservable()
    .pipe(
        withLatestFrom(state.select('journal')),
        switchMap(([path, actor]) =>
            from(actor.getJournal(toNullable(path || undefined))).pipe(
                tap(console.log),
                map(response => {
                    if (has(response, 'err')) {
                        const err = Object.keys(get(response, 'err') as unknown as DirectoryStateError)[0];
                        const message = `fileList.directory.get.errors.${err}`;
                        throw new Error(message);
                    }

                    const journal = get(response, 'ok') as unknown as DirectoryState;
                    const dirs = journal.dirs.map((dir: Directory) => ({
                        ...toDirectoryExtended(dir),
                        path
                    }));
                    const files = journal.files.map((file: File) => ({
                        ...toFileExtended(file),
                        path
                    }));
                    const breadcrumbs = journal.breadcrumbs.map(toDirectoryExtended);
                    const parentId = fromNullable<string>(journal.id);

                    return {
                        items: [...dirs, ...files] as JournalItem[],
                        breadcrumbs,
                        parent: parentId && path ? { id: parentId, path } : undefined
                    };
                })
            )
        ),
        catchError(err => {
            postMessage({ action: 'getJournalFailed', errorCode: err.message });
            return EMPTY;
        })
    )
    .subscribe(data => {
        postMessage({ action: 'getJournalSuccess', payload: data });
    });
