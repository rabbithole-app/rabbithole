import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { AsyncPipe, formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { Observable, asapScheduler } from 'rxjs';
import { observeOn } from 'rxjs/operators';
import { isNull } from 'lodash';

import { JOURNAL_CYCLES_SHARE } from '@core/constants';
import { BucketsService, ProfileService } from '@core/services';
import { addFASvgIcons } from '@core/utils';
import { InvoiceStage } from '@features/register/models';
import { JournalStatus, RegisterService } from '@features/register/services/register.service';
import { cyclesToICP } from '@features/wallet/utils';
import { environment } from 'environments/environment';
import { InvoiceComponent } from './components/invoice/invoice.component';
import { RedeemInviteDialogComponent } from './components/redeem-invite-dialog/redeem-invite-dialog.component';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [
        TranslocoModule,
        MatStepperModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        InvoiceComponent,
        RxIf,
        AsyncPipe,
        RedeemInviteDialogComponent,
        MatDialogModule
    ],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        ProfileService,
        { provide: TRANSLOCO_SCOPE, useValue: 'register' },
        {
            provide: STEPPER_GLOBAL_OPTIONS,
            useValue: { displayDefaultIndicatorType: false }
        }
    ]
})
export class RegisterComponent {
    readonly invoiceStage = InvoiceStage;
    readonly xdr: number = cyclesToICP(JOURNAL_CYCLES_SHARE);
    readonly usd = formatNumber(this.xdr * 1.3, 'en-US', '0.0-1');
    registerService = inject(RegisterService);
    bucketsService = inject(BucketsService);
    profileService = inject(ProfileService);
    loadingCreateJournal: Signal<boolean> = computed(() => this.registerService.journalStatus() === JournalStatus.Creating);
    redirect: Signal<boolean> = computed(() => this.registerService.journalStatus() === JournalStatus.Created);
    createInvoiceStep: Signal<boolean> = computed(() => !isNull(this.registerService.invoice()));
    invoiceStep: Signal<boolean> = computed(() => {
        const invoice = this.registerService.invoice();
        return invoice ? invoice.stage >= InvoiceStage.PAID : false;
    });
    createJournalStep: Signal<boolean> = computed(() => this.registerService.invoice()?.stage === InvoiceStage.COMPLETE);
    createInvoiceStateIcon: Signal<'number' | 'spinner'> = computed(() => (this.registerService.loadingCreateInvoice() ? 'spinner' : 'number'));
    createJournalStateIcon: Signal<'number' | 'spinner'> = computed(() =>
        this.registerService.journalStatus() === JournalStatus.Creating ? 'spinner' : 'number'
    );
    dialog = inject(MatDialog);
    selectedIndex: Signal<number> = computed(() => {
        let index = 0;
        if (this.createInvoiceStep()) index++;
        if (this.invoiceStep()) index++;
        return index;
    });
    selectedIndex$: Observable<number> = toObservable(this.selectedIndex).pipe(observeOn(asapScheduler));
    readonly inviteEnabled = !environment.registrationEnabled;

    constructor() {
        addFASvgIcons(['check', 'envelope', 'database'], 'far');
    }

    handleCreateInvoice(): void {
        this.registerService.createInvoice();
    }

    handleCreateJournal(): void {
        this.registerService.createJournal();
    }

    handleRedeem(): void {
        this.dialog.open(RedeemInviteDialogComponent, { width: '450px' });
    }
}
