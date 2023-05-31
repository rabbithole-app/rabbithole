import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { ActorSubclass } from '@dfinity/agent';
import { AccountIdentifier, ICPToken, LedgerCanister, Token, TokenAmount } from '@dfinity/nns';
import { Principal } from '@dfinity/principal';
import {
    catchError,
    combineLatestWith,
    connect,
    defer,
    filter,
    finalize,
    first,
    forkJoin,
    from,
    iif,
    map,
    merge,
    share,
    shareReplay,
    switchMap,
    throwError
} from 'rxjs';
import { get, has, isNull } from 'lodash';
import { createAgent } from '@dfinity/utils';

import { formatICP } from '../utils/icp';
import { BucketsService, NotificationService } from '@core/services';
import { AUTH_RX_STATE } from '@core/stores';
import { AccountIdentifier as AccountIdentifierRaw, Tokens, TransferError } from '@declarations/journal/journal.did';
import { LEDGER_CANISTER_ID } from '@core/constants';
import { environment } from 'environments/environment';

interface State {
    accountId: string;
    principal: string;
    icpToken: Token;
    icpLedger: LedgerCanister;
    icpAmount: TokenAmount;
    transactionFee: bigint;
    loadingBalance: boolean;
    loadingTransfer: boolean;
}

@Injectable()
export class WalletService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);
    private bucketsService = inject(BucketsService);
    private translocoService = inject(TranslocoService);
    private notificationService = inject(NotificationService);

    constructor() {
        super();
        this.set({
            icpToken: ICPToken,
            icpAmount: TokenAmount.fromE8s({ amount: 0n, token: ICPToken }),
            loadingBalance: true,
            loadingTransfer: false
        });
        const journalActor$ = this.bucketsService.select('journal').pipe(
            filter(actor => !isNull(actor)),
            map(actor => actor as NonNullable<typeof actor>),
            shareReplay(1)
        );
        const accountIdentifier$ = journalActor$.pipe(
            switchMap(actor => actor.accountIdentifier()),
            map(blob => {
                const hex = Buffer.from(blob).toString('hex');
                return AccountIdentifier.fromHex(hex);
            }),
            shareReplay(1)
        );
        const principal$ = this.authState.select('identity').pipe(map(identity => ({ principal: identity.getPrincipal().toString() })));
        this.connect(merge(accountIdentifier$.pipe(map(accountId => ({ accountId: accountId.toHex() }))), principal$));
        this.connect(
            this.authState.select('identity').pipe(
                combineLatestWith(accountIdentifier$),
                switchMap(([identity, accountIdentifier]) =>
                    from(createAgent({ identity, fetchRootKey: !environment.production })).pipe(
                        map(agent => LedgerCanister.create({ agent, canisterId: Principal.fromText(LEDGER_CANISTER_ID) })),
                        connect(shared =>
                            merge(
                                shared.pipe(map(icpLedger => ({ icpLedger }))),
                                shared.pipe(
                                    switchMap(ledger =>
                                        forkJoin([ledger.accountBalance({ accountIdentifier }), ledger.transactionFee()]).pipe(
                                            map(([amount, transactionFee]) => ({
                                                icpAmount: TokenAmount.fromE8s({ amount, token: ICPToken }),
                                                transactionFee,
                                                loadingBalance: false
                                            }))
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        );
    }

    transferICP(params: { to: [] | [AccountIdentifierRaw]; amount: Tokens }) {
        this.set({ loadingTransfer: true });
        const obs$ = this.bucketsService.select('journal').pipe(
            first(),
            switchMap(actor =>
                iif(
                    () => isNull(actor),
                    throwError(() => new Error('JournalActor is null')),
                    defer(() => (actor as NonNullable<typeof actor>).withdraw(params)).pipe(
                        map(result => {
                            if (has(result, 'err')) {
                                let [key, value] = Object.entries(get(result, 'err') as unknown as TransferError)[0];
                                if (key === 'InsufficientFunds') {
                                    value = `${formatICP(value.balance.e8s)} ICP`;
                                }
                                throw Error(this.translocoService.translate(`common.ledger.transfer.errors.${key}`, { value }));
                            }

                            return result;
                        })
                    )
                )
            ),
            catchError(err => {
                this.notificationService.error(err.message);
                return throwError(() => err);
            }),
            finalize(() => this.set({ loadingTransfer: false })),
            share()
        );
        obs$.subscribe({
            complete: () => {
                this.notificationService.success(this.translocoService.translate('common.ledger.transfer.successfullySent'));
                this.checkBalance();
            }
        });
        return obs$;
    }

    async checkBalance() {
        this.set({ loadingBalance: true });
        const { icpLedger: ledger, accountId } = this.get();
        const accountIdentifier = AccountIdentifier.fromHex(accountId);
        const amount = await ledger.accountBalance({ accountIdentifier });
        this.set({ icpAmount: TokenAmount.fromE8s({ amount, token: ICPToken }), loadingBalance: false });
    }
}
