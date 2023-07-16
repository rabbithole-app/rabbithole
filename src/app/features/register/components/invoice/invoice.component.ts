import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule } from '@ngneat/transloco';
import { RxPush } from '@rx-angular/template/push';
import { Observable } from 'rxjs';

import { CopyIDComponent } from '@core/components/copy-id/copy-id.component';
import { RegisterService } from '@features/register/services/register.service';
import { WalletItemComponent } from '@features/wallet/components/wallet-item/wallet-item.component';

@Component({
    selector: 'app-invoice',
    standalone: true,
    imports: [RxPush, TranslocoModule, MatCardModule, WalletItemComponent, CopyIDComponent, MatDividerModule],
    templateUrl: './invoice.component.html',
    styleUrls: ['./invoice.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceComponent {
    registerService = inject(RegisterService);
    accountId$ = this.registerService.select('accountId');
    loadingBalance$: Observable<boolean> = this.registerService.select('loadingBalance');
    amount: Signal<string> = computed(() => this.registerService.invoice()?.amount ?? '0');
    tokenSymbol$ = this.registerService.select('amount', 'token', 'symbol');
    balance$ = this.registerService.select('amount');
}
