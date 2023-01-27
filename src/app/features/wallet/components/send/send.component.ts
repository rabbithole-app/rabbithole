import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { AccountIdentifier, TokenAmount, Token } from '@dfinity/nns';
import { PushModule } from '@rx-angular/template/push';
import { RxState } from '@rx-angular/state';
import { TranslocoModule } from '@ngneat/transloco';
import { combineLatestWith, distinctUntilChanged, filter, map, Observable, startWith } from 'rxjs';
import { isEqual, isNull } from 'lodash';

import { WalletItemComponent } from '../wallet-item/wallet-item.component';
import { AmountAsyncValidator } from '@features/wallet/validators/amount.validator';
import { NotificationService } from '@core/services';
import { ReviewTransaction, Send } from '@features/wallet/models';
import { ReviewComponent } from '../review/review.component';
import { SendFormComponent } from '../send-form/send-form.component';
import { Tokens } from '@declarations/journal/journal.did';
import { E8S_PER_TOKEN } from '@core/constants';

enum Tabs {
    Start,
    Form,
    Review
}

interface State {
    token: Token;
    amount: TokenAmount;
    transactionFee: bigint;
    accountId: string;
    selectedTabIndex: Tabs;
}

@Component({
    selector: 'app-send',
    standalone: true,
    imports: [PushModule, NgIf, MatTabsModule, WalletItemComponent, TranslocoModule, SendFormComponent, ReviewComponent, ReactiveFormsModule],
    templateUrl: './send.component.html',
    styleUrls: ['./send.component.scss'],
    providers: [AmountAsyncValidator, RxState],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SendComponent extends RxState<State> {
    @Input() set token(value: Token) {
        this.set({ token: value });
    }
    get token(): Token {
        return this.get('token');
    }

    @Input() set amount(value: TokenAmount) {
        this.set({ amount: value });
    }
    get amount(): TokenAmount {
        return this.get('amount');
    }

    @Input() set transactionFee(value: bigint) {
        this.set({ transactionFee: value });
    }
    get transactionFee(): bigint {
        return this.get('transactionFee');
    }

    @Input() set accountId(value: string) {
        this.set({ accountId: value });
    }
    get accountId(): string {
        return this.get('accountId');
    }
    @Input() loadingTransfer: boolean = false;
    @Input() loadingBalance: boolean = false;
    @Output() transfer: EventEmitter<{ to: AccountIdentifier; amount: Tokens }> = new EventEmitter();
    @Output() refresh: EventEmitter<void> = new EventEmitter<void>();
    sendControl = new FormControl<{
        amount: bigint;
        recipient: string;
    } | null>(null);
    notificationService = inject(NotificationService);
    readonly Tabs = Tabs;

    review$: Observable<ReviewTransaction> = this.sendControl.valueChanges.pipe(
        startWith(this.sendControl.value),
        distinctUntilChanged(isEqual),
        filter(value => !isNull(value)),
        map(value => value as Send),
        map(({ amount: e8s, recipient }) => {
            const amount = (Number((e8s * 10_000n) / E8S_PER_TOKEN) / 10_000).toString();
            return { amount, recipient };
        }),
        combineLatestWith(this.select('transactionFee').pipe(map(fee => (Number(fee) / Number(E8S_PER_TOKEN)).toString()))),
        map(([{ amount, recipient: to }, fee]) => ({
            amount,
            to,
            from: this.accountId,
            fee,
            tokenSymbol: this.tokenSymbol
        }))
    );

    get tokenSymbol(): string {
        return this.get('token', 'symbol');
    }

    constructor() {
        super();
        this.set({ selectedTabIndex: Tabs.Start });
    }

    handleSend() {
        if (!this.sendControl.value) {
            throw Error('Invalid form data');
        }

        const { amount, recipient } = this.sendControl.value;
        const accountIdentifier = AccountIdentifier.fromHex(recipient);
        this.transfer.next({
            to: accountIdentifier,
            amount: { e8s: amount }
        });
    }

    reset(): void {
        this.set({ selectedTabIndex: Tabs.Start });
        this.sendControl.reset(null);
    }
}
