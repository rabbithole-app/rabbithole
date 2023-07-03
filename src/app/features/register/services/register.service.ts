import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CMCCanister } from '@dfinity/cmc';
import { AccountIdentifier, ICPToken, LedgerCanister, Token, TokenAmount } from '@dfinity/nns';
import { Principal } from '@dfinity/principal';
import { createAgent, fromNullable } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { get, has, isNull, isUndefined } from 'lodash';
import {
    catchError,
    combineLatestWith,
    concat,
    connect,
    delayWhen,
    filter,
    first,
    from,
    map,
    merge,
    of,
    repeat,
    share,
    shareReplay,
    switchMap,
    takeUntil,
    tap,
    throwError,
    timer,
    withLatestFrom
} from 'rxjs';

import { LEDGER_CANISTER_ID } from '@core/constants';
import { mapLedgerError } from '@core/operators';
import { BucketsService, NotificationService, ProfileService } from '@core/services';
import { AUTH_RX_STATE } from '@core/stores';
import { InviteError, ProfileCreate, UsernameError } from '@declarations/rabbithole/rabbithole.did';
import { environment } from 'environments/environment';
import { Invoice, InvoiceStage } from '../models';
import { prepareInvoice } from '../utils';

export enum UserStatus {
    Unregistered,
    Creating,
    Registered
}

export enum JournalStatus {
    Default,
    Creating,
    Created
}

export enum InviteStatus {
    Default,
    Redeeming,
    Redeemed
}

interface State {
    accountId: string;
    token: Token;
    ledger: LedgerCanister;
    amount: TokenAmount;
    loadingBalance: boolean;
    loadingCreateInvoice: boolean;
    // loadingCreateJournal: boolean;
    cmc: CMCCanister;
    icpToCyclesConversionRate: bigint;
    invoice: Invoice;
    userStatus: UserStatus;
    journalStatus: JournalStatus;
    inviteStatus: InviteStatus;
    worker: Worker;
}

@Injectable()
export class RegisterService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);
    private bucketsService = inject(BucketsService);
    private notificationService = inject(NotificationService);
    private translocoService = inject(TranslocoService);
    private profileService = inject(ProfileService);
    private router = inject(Router);
    private readonly invoicePollingInterval = 1000;

    constructor() {
        super();
        this.set({
            token: ICPToken,
            amount: TokenAmount.fromE8s({ amount: 0n, token: ICPToken }),
            loadingBalance: false,
            loadingCreateInvoice: false,
            // loadingCreateJournal: false
            userStatus: UserStatus.Unregistered,
            journalStatus: JournalStatus.Default,
            inviteStatus: InviteStatus.Default
        });

        if (typeof Worker !== 'undefined') {
            const worker = new Worker(new URL('../workers/register.worker', import.meta.url), { type: 'module' });
            this.set({ worker });
        }

        const accountIdentifier$ = this.authState.select('actor').pipe(
            switchMap(actor => actor.accountIdentifier()),
            map(blob => {
                const hex = Buffer.from(blob).toString('hex');
                return AccountIdentifier.fromHex(hex);
            }),
            shareReplay(1)
        );
        this.connect(accountIdentifier$.pipe(map(accountId => ({ accountId: accountId.toHex() }))));
        this.connect(
            this.authState.select('identity').pipe(
                combineLatestWith(accountIdentifier$),
                switchMap(([identity, accountIdentifier]) =>
                    from(createAgent({ identity, fetchRootKey: !environment.production })).pipe(
                        map(agent => LedgerCanister.create({ agent, canisterId: Principal.fromText(LEDGER_CANISTER_ID) })),
                        connect(shared =>
                            merge(
                                shared.pipe(map(ledger => ({ ledger }))),
                                concat(
                                    of({ loadingBalance: true }),
                                    shared.pipe(
                                        switchMap(ledger => ledger.accountBalance({ accountIdentifier })),
                                        map(amount => ({
                                            amount: TokenAmount.fromE8s({ amount, token: ICPToken }),
                                            loadingBalance: false
                                        }))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        );
        const invoice$ = this.select('invoice').pipe(
            filter(v => !isUndefined(v)),
            share()
        );
        const active$ = invoice$.pipe(
            map(({ stage }) => stage === InvoiceStage.ACTIVE),
            filter(v => v)
        );
        const paid$ = invoice$.pipe(
            map(({ stage }) => stage === InvoiceStage.PAID),
            filter(v => v)
        );
        const complete$ = invoice$.pipe(
            map(({ stage }) => stage === InvoiceStage.COMPLETE),
            filter(v => v)
        );
        const pollInvoice$ = timer(0, this.invoicePollingInterval).pipe(
            switchMap(() =>
                this.authState.select('actor').pipe(
                    switchMap(actor => from(actor.getInvoice()).pipe(map(v => fromNullable(v)))),
                    map(v => (v ? { invoice: prepareInvoice(v) } : { invoice: v }))
                )
            ),
            takeUntil(merge(paid$, complete$)),
            repeat({ delay: () => active$ })
        );
        this.connect(pollInvoice$);
    }

    async checkBalance() {
        this.set({ loadingBalance: true });
        const { ledger, accountId, token } = this.get();
        try {
            const accountIdentifier = AccountIdentifier.fromHex(accountId);
            const amount = await ledger.accountBalance({ accountIdentifier });
            this.set({ amount: TokenAmount.fromE8s({ amount, token }) });
        } finally {
            this.set({ loadingBalance: false });
        }
    }

    async createInvoice() {
        this.set({ loadingCreateInvoice: true });
        const actor = this.authState.get('actor');
        try {
            const invoice = await actor.createInvoice();
            this.set({ invoice: prepareInvoice(invoice) });
        } finally {
            this.set({ loadingCreateInvoice: false });
        }
    }

    createProfile(profile: ProfileCreate) {
        this.set({ userStatus: UserStatus.Creating });
        this.authState
            .select('actor')
            .pipe(
                first(),
                switchMap(actor => actor.createProfile(profile)),
                map(result => {
                    if (has(result, 'err.alreadyExists')) {
                        throw Error(this.translocoService.translate('createProfile.answers.alreadyExists'));
                    } else if (has(result, 'err.username')) {
                        const key = Object.keys(get(result, 'err.username') as unknown as UsernameError)[0]
                            .replace('illegalCharacters', 'pattern')
                            .replace('maxLength', 'maxlength')
                            .replace('minLength', 'minlength');
                        throw Error(this.translocoService.translate(`createProfile.username.errors.${key}`));
                    }

                    return null;
                }),
                catchError(err => {
                    this.notificationService.error(err.message);
                    return throwError(() => err);
                }),
                tap({
                    error: () => this.set({ userStatus: UserStatus.Unregistered }),
                    complete: () => {
                        this.set({ userStatus: UserStatus.Registered });
                        this.notificationService.success(this.translocoService.translate('createProfile.messages.successfullyCreated'));
                        this.profileService.update();
                    }
                }),
                delayWhen(() => this.profileService.select('profile').pipe(filter(v => !isNull(v))))
            )
            .subscribe({
                complete: async () => {
                    await this.router.navigate(['/drive']);
                }
            });
    }

    redeemInvite(id: string) {
        this.set({ inviteStatus: InviteStatus.Redeeming });
        this.authState
            .select('actor')
            .pipe(
                first(),
                switchMap(actor => actor.redeemInvite(id)),
                map(response => {
                    if (has(response, 'err')) {
                        const key = Object.keys(get(response, 'err') as unknown as InviteError)[0];
                        throw Error(this.translocoService.translate(`invite.invite.errors.${key}`));
                    }

                    return response;
                }),
                catchError(err => {
                    this.notificationService.error(err.message);
                    return throwError(() => err);
                }),
                tap({
                    error: () => this.set({ inviteStatus: InviteStatus.Default }),
                    complete: () => {
                        this.bucketsService.update();
                        this.set({ inviteStatus: InviteStatus.Redeemed });
                    }
                }),
                delayWhen(() =>
                    this.bucketsService.select(selectSlice(['journal', 'loaded'])).pipe(filter(({ loaded, journal }) => loaded && !isNull(journal)))
                )
            )
            .subscribe({
                complete: async () => {
                    await this.router.navigateByUrl('/404', { skipLocationChange: true });
                    await this.router.navigate(['/register']);
                }
            });
    }

    createJournal() {
        this.set({ journalStatus: JournalStatus.Creating });
        this.authState
            .select('actor')
            .pipe(
                first(),
                withLatestFrom(this.select('invoice', 'id')),
                switchMap(([actor, invoiceId]) => actor.createJournal(invoiceId)),
                mapLedgerError(),
                map(response => {
                    if (has(response, 'err.wrongStage')) {
                        throw Error(this.translocoService.translate('register.steps.createJournal.errors.wrongStage'));
                    }

                    return response;
                }),
                catchError(err => {
                    this.notificationService.error(err.message);
                    return throwError(() => err);
                }),
                tap({
                    error: () => this.set({ journalStatus: JournalStatus.Default }),
                    complete: () => {
                        this.bucketsService.update();
                        this.set({ journalStatus: JournalStatus.Created });
                    }
                }),
                delayWhen(() =>
                    this.bucketsService.select(selectSlice(['journal', 'loaded'])).pipe(filter(({ loaded, journal }) => loaded && !isNull(journal)))
                )
            )
            .subscribe({
                complete: async () => {
                    await this.router.navigateByUrl('/404', { skipLocationChange: true });
                    await this.router.navigate(['/register']);
                }
            });
    }
}
