import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { NgIf } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { RxPush } from '@rx-angular/template/push';
import { Observable, Subject, asyncScheduler, merge, of, timer } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';

import { addFASvgIcons } from '@core/utils';
import { WalletService } from '@features/wallet/services';

interface State {
    copyMessage: string;
    tooltip: MatTooltip;
}

@Component({
    selector: 'app-account',
    standalone: true,
    imports: [NgIf, RxPush, ClipboardModule, MatTooltipModule, TranslocoModule, MatButtonModule, MatIconModule],
    templateUrl: './account.component.html',
    styleUrls: ['./account.component.scss']
})
export class AccountComponent {
    // accountState = inject(ACCOUNT_RX_STATE);
    private walletService = inject(WalletService);
    accountId$: Observable<string> = this.walletService.select('accountId');
    translocoService = inject(TranslocoService);
    readonly copyTooltipMessage = this.translocoService.translate('common.tooltips.copy.clipboard');
    clipboard = inject(Clipboard);
    copyAID: Subject<void> = new Subject<void>();
    private copy$: Observable<string> = of(this.copyTooltipMessage);
    private copied$ = this.copyAID
        .asObservable()
        .pipe(
            switchMap(() => merge(of(this.translocoService.translate<string>('common.tooltips.copy.copied')), timer(1000).pipe(switchMap(() => this.copy$))))
        );
    state = new RxState<State>();
    @ViewChild(MatTooltip) set tooltip(value: MatTooltip) {
        this.state.set({ tooltip: value });
    }

    constructor() {
        this.state.connect(
            this.copied$.pipe(
                startWith(this.copyTooltipMessage),
                map(copyMessage => ({ copyMessage }))
            )
        );
        addFASvgIcons(['copy'], 'far');
    }

    copy(accountId: string) {
        this.clipboard.copy(accountId);
        this.state.set({ copyMessage: this.translocoService.translate('common.tooltips.copy.copied') });
        asyncScheduler.schedule(() => {
            this.state.set({ copyMessage: this.translocoService.translate('common.tooltips.copy.clipboard') });
        }, 3000);
    }

    get copyMessage(): string {
        return this.state.get('copyMessage');
    }
}
