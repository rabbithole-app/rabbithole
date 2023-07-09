import { ChangeDetectionStrategy, Component, HostListener, inject, ViewChild } from '@angular/core';
import { AccountIdentifier, ICPToken, Token, TokenAmount } from '@dfinity/nns';
import { toNullable } from '@dfinity/utils';
import { RxPush } from '@rx-angular/template/push';
import { lastValueFrom, Observable } from 'rxjs';

import { Tokens } from '@declarations/journal/journal.did';
import { AccountComponent } from './components/account/account.component';
import { SendComponent } from './components/send/send.component';
import { WalletService } from './services';

@Component({
    standalone: true,
    selector: 'app-wallet',
    templateUrl: './wallet.component.html',
    styleUrls: ['./wallet.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RxPush, SendComponent, AccountComponent]
})
export class WalletComponent {
    @ViewChild(SendComponent, { static: true }) sendComponent!: SendComponent;
    walletService = inject(WalletService);
    amount$: Observable<TokenAmount> = this.walletService.select('icpAmount');
    transactionFee$: Observable<bigint> = this.walletService.select('transactionFee');
    accountId$: Observable<string> = this.walletService.select('accountId');
    readonly token: Token = ICPToken;

    @HostListener('click', ['$event']) handleClick(event: MouseEvent) {
        event.stopPropagation();
    }

    async transferICP(params: { to: AccountIdentifier; amount: Tokens }) {
        const result = this.walletService.transferICP({ to: toNullable(params.to.toUint8Array()), amount: params.amount });
        await lastValueFrom(result);
        this.sendComponent.reset();
    }

    refreshBalance() {
        this.walletService.checkBalance();
    }
}
