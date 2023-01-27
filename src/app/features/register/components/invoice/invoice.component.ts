import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';
import { TranslocoModule } from '@ngneat/transloco';
import { MatCardModule } from '@angular/material/card';
import { Observable } from 'rxjs';

import { WalletItemComponent } from '@features/wallet/components/wallet-item/wallet-item.component';
import { CopyIDComponent } from '@core/components/copy-id/copy-id.component';
import { MatDividerModule } from '@angular/material/divider';
import { RegisterService } from '@features/register/services/register.service';

@Component({
    selector: 'app-invoice',
    standalone: true,
    imports: [PushModule, TranslocoModule, MatCardModule, WalletItemComponent, CopyIDComponent, MatDividerModule],
    templateUrl: './invoice.component.html',
    styleUrls: ['./invoice.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceComponent {
    registerService = inject(RegisterService);
    accountId$ = this.registerService.select('accountId');
    loadingBalance$: Observable<boolean> = this.registerService.select('loadingBalance');
    amount$ = this.registerService.select('invoice', 'amount');
    tokenSymbol$ = this.registerService.select('amount', 'token', 'symbol');
    balance$ = this.registerService.select('amount');
}
