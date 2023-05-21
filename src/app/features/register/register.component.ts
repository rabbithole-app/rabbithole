import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { formatNumber } from '@angular/common';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MatStepperModule } from '@angular/material/stepper';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { asyncScheduler, debounceTime, distinctUntilChanged, map, merge, Observable, observeOn, scan } from 'rxjs';
import { PushPipe } from '@rx-angular/template/push';
import { RxState } from '@rx-angular/state';
import { RxIf } from '@rx-angular/template/if';
import { isUndefined, pickBy, size } from 'lodash';

import { cyclesToICP } from '@features/wallet/utils';
import { JOURNAL_CYCLES_SHARE } from '@core/constants';
import { addFASvgIcons } from '@core/utils';
import { InvoiceStage } from '@features/register/models';
import { JournalStatus, RegisterService } from '@features/register/services/register.service';
import { InvoiceComponent } from './components/invoice/invoice.component';
import { BucketsService, ProfileService } from '@core/services';
import { RedeemInviteDialogComponent } from './components/redeem-invite-dialog/redeem-invite-dialog.component';

enum Step {
    CREATE_INVOICE,
    INVOICE,
    REDEEM_INVITE,
    CREATE_JOURNAL
}

interface State {
    completed: Record<keyof typeof Step, boolean>;
    selectedIndex: number;
    createInvoiceStateIcon: 'number' | 'spinner';
    createJournalStateIcon: 'number' | 'spinner';
    invite: boolean;
}

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [
        TranslocoModule,
        MatStepperModule,
        PushPipe,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        InvoiceComponent,
        RxIf,
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
export class RegisterComponent extends RxState<State> {
    readonly invoiceStage = InvoiceStage;
    readonly xdr: number = cyclesToICP(JOURNAL_CYCLES_SHARE);
    readonly usd = formatNumber(this.xdr * 1.3, 'en-US', '0.0-1');
    registerService = inject(RegisterService);
    bucketsService = inject(BucketsService);
    profileService = inject(ProfileService);
    loadingCreateInvoice$: Observable<boolean> = this.registerService.select('loadingCreateInvoice');
    loadingCreateJournal$: Observable<boolean> = this.registerService.select('journalStatus').pipe(map(status => status === JournalStatus.Creating));
    redirect$: Observable<boolean> = this.registerService.select('journalStatus').pipe(map(status => status === JournalStatus.Created));
    createInvoiceCompleted$: Observable<boolean> = this.select('completed', Step[Step.CREATE_INVOICE] as keyof typeof Step);
    invoiceCompleted$: Observable<boolean> = this.select('completed', Step[Step.INVOICE] as keyof typeof Step);
    createJournalCompleted$: Observable<boolean> = this.select('completed', Step[Step.CREATE_JOURNAL] as keyof typeof Step);
    createInvoiceStateIcon$ = this.select('createInvoiceStateIcon');
    createJournalStateIcon$ = this.select('createJournalStateIcon');
    invite$: Observable<boolean> = this.select('invite');
    selectedIndex$ = this.select('selectedIndex').pipe(debounceTime(500), observeOn(asyncScheduler));
    dialog = inject(MatDialog);

    constructor() {
        super();
        addFASvgIcons(['check', 'envelope', 'database'], 'far');
        this.set({
            createInvoiceStateIcon: 'number',
            createJournalStateIcon: 'number',
            invite: true
        });
        const createInvoiceStep$ = this.registerService.select('invoice').pipe(map(v => ({ [Step[Step.CREATE_INVOICE]]: !isUndefined(v) })));
        const invoiceStep$ = this.registerService.select('invoice').pipe(map(({ stage }) => ({ [Step[Step.INVOICE]]: stage >= InvoiceStage.PAID })));
        const createJournalStep$ = this.registerService
            .select('invoice')
            .pipe(map(({ stage }) => ({ [Step[Step.CREATE_JOURNAL]]: stage === InvoiceStage.COMPLETE })));
        const completed$ = merge(createInvoiceStep$, invoiceStep$, createJournalStep$).pipe(
            scan((state, value) => ({ ...state, ...value }), {} as Record<keyof typeof Step, boolean>),
            distinctUntilChanged()
        );
        this.connect(completed$.pipe(map(completed => ({ completed, selectedIndex: Math.min(size(pickBy(completed, v => v)), 2) }))));
        this.connect(
            merge(
                this.registerService.select('journalStatus').pipe(
                    map(status => ({
                        createJournalStateIcon: status === JournalStatus.Creating ? 'spinner' : 'number'
                    }))
                ),
                this.registerService.select('loadingCreateInvoice').pipe(map(loading => ({ createInvoiceStateIcon: loading ? 'spinner' : 'number' })))
            ).pipe(map(v => v as Partial<State>))
        );
    }

    handleCreateInvoice(event: MouseEvent): void {
        this.registerService.createInvoice();
    }

    handleCreateJournal(event: MouseEvent): void {
        this.registerService.createJournal();
    }

    handleRedeem(event: MouseEvent): void {
        this.dialog.open(RedeemInviteDialogComponent, { width: '450px' });
    }
}
