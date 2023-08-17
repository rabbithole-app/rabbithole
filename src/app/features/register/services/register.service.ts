import { computed, inject, Injectable, isDevMode, Signal, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CMCCanister } from '@dfinity/cmc';
import { AccountIdentifier, LedgerCanister } from '@dfinity/nns';
import { Principal } from '@dfinity/principal';
import { createAgent, fromNullable, ICPToken, Token, TokenAmount } from '@dfinity/utils';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { get, has, isEqual, isNull } from 'lodash';
import { concat, EMPTY, from, merge, of, throwError, timer } from 'rxjs';
import { catchError, combineLatestWith, connect, delayWhen, filter, first, map, repeat, share, shareReplay, switchMap, takeUntil, tap } from 'rxjs/operators';

import { LEDGER_CANISTER_ID } from '@core/constants';
import { mapLedgerError } from '@core/operators';
import { BucketsService, NotificationService, ProfileService } from '@core/services';
import { AUTH_RX_STATE } from '@core/stores';
import { InviteError, ProfileCreateV2, UsernameError } from '@declarations/rabbithole/rabbithole.did';
import { Invoice, InvoiceStage } from '../models';
import { prepareInvoice } from '../utils';

export enum ProfileStatus {
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
    cmc: CMCCanister;
    icpToCyclesConversionRate: bigint;
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

    invoice: WritableSignal<Invoice | null> = signal(null, { equal: isEqual });
    loadingCreateInvoice: WritableSignal<boolean> = signal(false);
    invoiceActive: Signal<boolean> = computed(() => {
        const invoice = this.invoice();
        return invoice?.stage === InvoiceStage.ACTIVE;
    });
    profileStatus: WritableSignal<ProfileStatus> = signal(ProfileStatus.Unregistered);
    journalStatus: WritableSignal<JournalStatus> = signal(JournalStatus.Default);
    inviteStatus: WritableSignal<InviteStatus> = signal(InviteStatus.Default);

    constructor() {
        super();
        this.set({
            token: ICPToken,
            amount: TokenAmount.fromE8s({ amount: 0n, token: ICPToken }),
            loadingBalance: false
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
                    from(createAgent({ identity, fetchRootKey: isDevMode() })).pipe(
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
        const invoice$ = toObservable(this.invoice).pipe(
            filter((v): v is NonNullable<typeof v> => !isNull(v)),
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
        timer(0, this.invoicePollingInterval)
            .pipe(
                switchMap(() =>
                    this.authState.select('actor').pipe(
                        switchMap(actor => from(actor.getInvoice()).pipe(map(v => fromNullable(v)))),
                        map(v => (v ? prepareInvoice(v) : null))
                    )
                ),
                takeUntil(merge(paid$, complete$)),
                repeat({ delay: () => active$ }),
                takeUntilDestroyed()
            )
            .subscribe(invoice => this.invoice.set(invoice));
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
        this.loadingCreateInvoice.set(true);
        const actor = this.authState.get('actor');
        try {
            const invoice = await actor.createInvoice();
            this.invoice.set(prepareInvoice(invoice));
        } finally {
            this.loadingCreateInvoice.set(false);
        }
    }

    createProfile(profile: ProfileCreateV2) {
        this.profileStatus.set(ProfileStatus.Creating);
        this.authState
            .select('actor')
            .pipe(
                first(),
                switchMap(actor => actor.createProfile(profile)),
                map(result => {
                    if (has(result, 'err.alreadyExists')) {
                        throw Error(this.translocoService.translate('profile.create.messages.alreadyExists'));
                    } else if (has(result, 'err.username')) {
                        const key = Object.keys(get(result, 'err.username') as unknown as UsernameError)[0]
                            .replace('illegalCharacters', 'pattern')
                            .replace('maxLength', 'maxlength')
                            .replace('minLength', 'minlength');
                        throw Error(this.translocoService.translate(`profile.create.username.errors.${key}`));
                    }

                    return null;
                }),
                catchError(err => {
                    this.notificationService.error(err.message);
                    return throwError(() => err);
                }),
                tap({
                    error: () => this.profileStatus.set(ProfileStatus.Unregistered),
                    complete: () => {
                        this.profileStatus.set(ProfileStatus.Registered);
                        this.notificationService.success(this.translocoService.translate('profile.create.messages.successfullyCreated'));
                        this.profileService.refresh();
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
        this.inviteStatus.set(InviteStatus.Redeeming);
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
                    error: () => this.inviteStatus.set(InviteStatus.Default),
                    complete: () => {
                        this.bucketsService.update();
                        this.inviteStatus.set(InviteStatus.Redeemed);
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
        this.journalStatus.set(JournalStatus.Creating);
        this.authState
            .select('actor')
            .pipe(
                first(),
                switchMap(actor => {
                    const invoice = this.invoice();
                    if (!invoice) return EMPTY;
                    return actor.createJournal(invoice.id);
                }),
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
                    error: () => this.journalStatus.set(JournalStatus.Default),
                    complete: () => {
                        this.bucketsService.update();
                        this.journalStatus.set(JournalStatus.Created);
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
