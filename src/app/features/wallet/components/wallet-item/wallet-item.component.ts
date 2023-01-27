import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, inject, Input, Output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ICPToken, TokenAmount } from '@dfinity/nns';
import { TranslocoModule } from '@ngneat/transloco';
import { IfModule } from '@rx-angular/template/if';

import { E8S_PER_TOKEN } from '@core/constants';
import { addFASvgIcons } from '@core/utils';

@Component({
    selector: 'app-wallet-item',
    standalone: true,
    imports: [IfModule, MatTooltipModule, MatIconModule, MatButtonModule, TranslocoModule, MatProgressSpinnerModule],
    templateUrl: './wallet-item.component.html',
    styleUrls: ['./wallet-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletItemComponent {
    @Input() tokenAmount: TokenAmount = TokenAmount.fromE8s({ amount: 0n, token: ICPToken });
    @Input() loading: boolean = false;
    @HostBinding('class.actions')
    @Input()
    actionsEnabled: boolean = true;
    @Output() send: EventEmitter<void> = new EventEmitter<void>();
    @Output() refresh: EventEmitter<void> = new EventEmitter<void>();
    private matIconRegistry = inject(MatIconRegistry);
    private domSanitizer = inject(DomSanitizer);

    constructor() {
        addFASvgIcons(['paper-plane-top', 'arrows-rotate'], 'far');
        this.matIconRegistry.addSvgIconInNamespace(
            'ic',
            'token',
            this.domSanitizer.bypassSecurityTrustResourceUrl(`../../../../assets/icons/icp-token-light.svg`)
        );
    }

    get amount() {
        return Number((this.tokenAmount.toE8s() * 1000n) / E8S_PER_TOKEN) / 1000;
    }
}
