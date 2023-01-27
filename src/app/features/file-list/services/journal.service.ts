import { inject, Injectable } from '@angular/core';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import { ActorSubclass, Identity } from '@dfinity/agent';
import { fromNullable, toNullable } from '@dfinity/utils';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import {
    asyncScheduler,
    defer,
    delay,
    delayWhen,
    EMPTY,
    finalize,
    first,
    firstValueFrom,
    forkJoin,
    from,
    iif,
    merge,
    Observable,
    observeOn,
    of,
    scheduled,
    shareReplay,
    throwError
} from 'rxjs';
import { catchError, filter, map, switchMap, take, tap, withLatestFrom } from 'rxjs/operators';
import { get, has, isNil, isNull, isUndefined, partition } from 'lodash';

import { createActor } from '@core/utils';
import { AUTH_RX_STATE } from '@core/stores';
import { BucketsService, NotificationService } from '@core/services';
// import { _SERVICE as ManagerActor, Bucket } from '@declarations/rabbithole/rabbithole.did';
import { Directory, DirectoryMoveError, _SERVICE as JournalBucketActor, Tokens, AccountIdentifier } from '@declarations/journal/journal.did';
import { _SERVICE as RabbitholeActor } from '@declarations/rabbithole/rabbithole.did';
import { DirectoryCreate, DirectoryExtended, JournalItem } from '@features/file-list/models';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toDirectoryExtended, toFileExtended } from '@features/file-list/utils';
import { SnackbarProgressService } from '@features/file-list/services/snackbar-progress.service';
import { FILE_LIST_RX_STATE } from '@features/file-list/file-list.store';

// import { AccountIdentifier } from '@dfinity/nns';
// import { TransferRequest } from '@features/wallet/models';

const JournalIdlFactory = require('declarations/journal').idlFactory;

export interface BucketActor<T> {
    bucketId: Principal;
    actor: T;
    balance: bigint;
}

/*export interface CanisterBalance {
    bucketId: Principal;
    balance: bigint;
}

export interface CanistersBalance {
    data: CanisterBalance;
    storage: CanisterBalance;
}*/

// interface State<T, R> {
//     data: BucketActor<T>;
//     storage: BucketActor<R>;
// }

interface State {
    // version?: string;
    // actor: ActorSubclass<JournalBucketActor> | null;
    // items: JournalItem[];
    // loading: boolean;
}

@Injectable()
export class JournalService extends RxState<State> {
    // private actorService = inject(ActorService<RabbitholeActor>);
    // private route = inject(ActivatedRoute);
    // private router = inject(Router);
    // private managerActorService: ActorService<ManagerActor> = inject(ManagerActorService);
    // private journalState = inject(JOURNAL_RX_STATE);
    private bucketsService = inject(BucketsService);
    private notificationService = inject(NotificationService);
    private snackbarProgressService = inject(SnackbarProgressService);
    private fileListState = inject(FILE_LIST_RX_STATE);
    // actor$: Observable<ActorSubclass<JournalBucketActor> | undefined> = this.select('actor').pipe(shareReplay(1));

    constructor() {
        super();
        /*this.set({
            loading: false,
            items: []
        });*/
        /*this.connect(
            'actor',
            this.authState
                .select('identity')
                .pipe(
                    switchMap(identity => iif(() => isUndefined(identity) || identity.getPrincipal().isAnonymous(), of(null), this.getJournalBucket(identity)))
                )
        );*/
        /*this.connect(
            'version',
            this.fileListState.select('actor').pipe(
                filter(actor => !isNil(actor)),
                switchMap(actor => (actor as ActorSubclass<JournalBucketActor>).getVersion())
            )
        );*/
        // this.connect(
        //     this.route.url.pipe(
        //         map(segments => segments.map(({ path }) => path).join('/')),
        //         switchMap(path =>
        //             this.journalState.select('actor').pipe(
        //                 switchMap(actor => {
        //                     return iif(
        //                         () => isNil(actor),
        //                         EMPTY,
        //                         defer(() => (actor as ActorSubclass<JournalBucketActor>).getJournal(toNullable(path))).pipe(
        //                             tap(response => console.log(toNullable(path), response)),
        //                             map(response => {
        //                                 if (has(response, 'err')) {
        //                                     throw new Error(Object.keys(get(response, 'err') as unknown as Record<string, void>)[0]);
        //                                 }

        //                                 return get(response, 'ok') as unknown as {
        //                                     id: [] | [string];
        //                                     files: File[];
        //                                     dirs: Directory[];
        //                                     breadcrumbs: Directory[];
        //                                 };
        //                             })
        //                         )
        //                     );
        //                 }),
        //                 map(journal => {
        //                     const dirs = journal.dirs.map(toDirectoryExtended);
        //                     const files = journal.files.map(toFileExtended);

        //                     return [...dirs, ...files];
        //                 })
        //             )
        //         ),
        //         map(items => ({ items, loading: false }))
        //     )
        // );
    }

    async createDirectory({ id, name, parentId }: { id: string; name: string; parentId?: string }) {
        const tempDirectory: DirectoryExtended = { id, name, parentId, type: 'folder', color: 'blue', children: undefined, loading: true, disabled: true };
        this.fileListState.set('items', state => [...state.items, tempDirectory]);
        this.wrapActionHandler(actor => actor.createDirectory({ id, name, parentId: toNullable(parentId) }))
            .pipe(
                switchMap(result => {
                    if (has(result, 'err')) {
                        // TODO: перевод ошибок
                        return throwError(() => new Error(Object.keys(get(result, 'err') as unknown as Record<string, void>)[0]));
                    }
                    const directory = toDirectoryExtended(get(result, 'ok') as unknown as Directory);
                    return of(directory);
                })
            )
            .subscribe({
                error: () => this.fileListState.set('items', state => state.items.filter(item => item.id !== id)),
                next: directory => this.fileListState.set('items', state => [...state.items.filter(item => item.id !== id), directory]),
                complete: () => this.notificationService.success('Directory was successfully created!')
            });
    }

    // canisterBalance() {
    //     return this.select(
    //         selectSlice(['data', 'storage']),
    //         map(({ data, storage }) => ({ data: data.balance, storage: storage.balance }))
    //         /*switchMap(({ data, storage }) => {
    //             return forkJoin(data.actor.cyclesBalance(), storage.actor.cyclesBalance()).pipe(map(([data, storage]) => ({ data, storage })));
    //         })*/
    //     );
    // }

    /*getBucket<T>({ idlFactory, bucket }: { idlFactory: IDL.InterfaceFactory; bucket: Bucket }): Observable<Omit<BucketActor<T>, 'balance'>> {
        if (!this.identity) {
            return throwError(() => new Error('Invalid identity.'));
        }

        const bucketId = fromNullable<Principal>(bucket.bucketId);

        if (isUndefined(bucketId)) {
            return throwError(() => new Error('Invalid bucket.'));
        }

        return createActor<T>({
            identity: this.identity,
            idlFactory,
            canisterId: bucketId as Principal
        }).pipe(
            map(actor => ({
                bucketId: bucketId as Principal,
                actor
            }))
        );
    }*/

    // getDataBucket(): Observable<BucketActor<DataBucketActor>> {
    //     return this.managerActorService.actor$.pipe(
    //         switchMap(actor => this.initDataBucket(actor)),
    //         switchMap(bucket =>
    //             this.getBucket<DataBucketActor>({
    //                 idlFactory: DataIdlFactory,
    //                 bucket
    //             })
    //         ),
    //         switchMap(bucket => from(bucket.actor.cyclesBalance()).pipe(map(balance => ({ ...bucket, balance }))))
    //     );
    // }

    // getJournalBucket(identity: Identity): Observable<ActorSubclass<JournalBucketActor>> {
    //     return this.authState.select('actor').pipe(
    //         switchMap(actor => actor.getJournalBucket()),
    //         switchMap(bucketId =>
    //             createActor<JournalBucketActor>({
    //                 identity,
    //                 idlFactory: JournalIdlFactory,
    //                 canisterId: bucketId
    //             })
    //         ),
    //         catchError(err => {
    //             this.notificationService.error(err.message);
    //             return throwError(() => err);
    //         })
    //     );
    // }

    private wrapActionHandler<T>(callback: (actor: ActorSubclass<JournalBucketActor>) => Promise<T>) {
        return this.bucketsService.select('journal').pipe(
            first(),
            switchMap(actor =>
                iif(
                    () => isNil(actor),
                    throwError(() => new Error("User isn't authorized")),
                    defer(() => callback(actor as unknown as ActorSubclass<JournalBucketActor>))
                )
            ),
            catchError(err => {
                this.notificationService.error(err.message);
                return throwError(() => err);
            })
        );
    }

    move(selected: JournalItem[], targetPath: string | null) {
        const selectedIds = selected.map(({ id }) => id);
        this.updateItems(id => selectedIds.includes(id), { disabled: true });
        const handler: (item: JournalItem) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => {
                const sourcePath = isNil(item.path) ? item.name : `${item.path}/${item.name}`;
                const preparedTargetPath = toNullable(targetPath ?? undefined);
                return item.type === 'folder' ? actor.moveDirectory(sourcePath, preparedTargetPath) : actor.moveFile(sourcePath, preparedTargetPath);
            }).pipe(
                switchMap(result => {
                    if (has(result, 'err')) {
                        // TODO: перевод ошибок
                        return throwError(() => new Error(Object.keys(get(result, 'err') as unknown as DirectoryMoveError)[0]));
                    }

                    return of(true);
                }),
                tap({
                    error: err => console.error(err),
                    finalize: () => this.updateItems(id => id === item.id, { disabled: false }),
                    complete: () => this.fileListState.set('items', state => state.items.filter(({ id }) => item.id !== id))
                })
            );
        this.snackbarProgressService.add<JournalItem>('move', selected, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.updateItems(id => selectedIds.includes(id), { disabled: false }));
    }

    remove(selected: JournalItem[]) {
        const selectedIds = selected.map(({ id }) => id);
        this.updateItems(id => selectedIds.includes(id), { disabled: true });
        this.updateBreadcrumbs(id => selectedIds.includes(id), { loading: true });
        const handler: (item: JournalItem) => Observable<unknown> = item =>
            this.wrapActionHandler(actor => {
                const path = isNil(item.path) ? item.name : `${item.path}/${item.name}`;
                return item.type === 'folder' ? actor.deleteDirectory(path) : actor.deleteFile(path);
            }).pipe(
                switchMap(result => {
                    if (has(result, 'err')) {
                        // TODO: перевод ошибок
                        return throwError(() => new Error(Object.keys(get(result, 'err') as unknown as Record<string, any>)[0]));
                    }

                    return of(true);
                }),
                tap({
                    error: err => console.error(err),
                    finalize: () => {
                        this.updateItems(id => id === item.id, { disabled: false });
                        this.updateBreadcrumbs(id => id === item.id, { loading: false });
                    },
                    complete: () => {
                        this.fileListState.set(state => ({
                            items: state.items.filter(({ id }) => item.id !== id),
                            breadcrumbs: state.breadcrumbs.filter(({ id }) => item.id !== id)
                        }));
                    }
                })
            );
        this.snackbarProgressService.add<JournalItem>('remove', selected, handler);
        this.snackbarProgressService.snackBarRef
            ?.afterDismissed()
            .pipe(switchMap(({ dismissedByAction }) => iif(() => dismissedByAction, of(true), EMPTY)))
            .subscribe(() => this.updateItems(id => selectedIds.includes(id), { disabled: false }));
    }

    private updateItems(iteratee: (id: string) => boolean, value: Partial<JournalItem>) {
        this.fileListState.set('items', state => state.items.map<JournalItem>(item => (iteratee(item.id) ? ({ ...item, ...value } as JournalItem) : item)));
    }

    private updateBreadcrumbs(iteratee: (id: string) => boolean, value: Partial<DirectoryExtended>) {
        this.fileListState.set('breadcrumbs', state => state.breadcrumbs.map(item => (iteratee(item.id) ? { ...item, ...value } : item)));
    }

    async deleteStorage(id: string) {
        try {
            const actor = this.bucketsService.get('journal');
            if (actor) {
                await actor.deleteStorage(Principal.fromText(id));
                this.notificationService.success('Storage deleted successfully');
            } else {
                throw Error('JournalActor is null');
            }
        } catch (e) {
            this.notificationService.error((e as Error).message);
        }
    }
}
