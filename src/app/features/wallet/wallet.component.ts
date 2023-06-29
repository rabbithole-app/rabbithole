import { RxPush } from '@rx-angular/template/push';
import { ChangeDetectionStrategy, Component, HostListener, inject, ViewChild } from '@angular/core';
import { lastValueFrom, Observable } from 'rxjs';
import { toNullable } from '@dfinity/utils';
import { AccountIdentifier, TokenAmount, ICPToken, Token } from '@dfinity/nns';

import { SendComponent } from './components/send/send.component';
import { AccountComponent } from './components/account/account.component';
import { WalletService } from './services';
import { Tokens } from '@declarations/journal/journal.did';

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
    private walletService = inject(WalletService);
    amount$: Observable<TokenAmount> = this.walletService.select('icpAmount');
    transactionFee$: Observable<bigint> = this.walletService.select('transactionFee');
    loadingTransfer$: Observable<boolean> = this.walletService.select('loadingTransfer');
    loadingBalance$: Observable<boolean> = this.walletService.select('loadingBalance');
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
