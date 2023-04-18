import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { IfModule } from '@rx-angular/template/if';
import { AsyncSubject, filter, map, Observable, startWith, takeUntil } from 'rxjs';

import { InviteValidator } from '@core/validators';
import { addFASvgIcons } from '@core/utils';
import { InviteStatus, RegisterService } from '@features/register/services/register.service';

@Component({
    selector: 'app-redeem-invite-dialog',
    standalone: true,
    imports: [
        MatFormFieldModule,
        TranslocoModule,
        MatInputModule,
        ReactiveFormsModule,
        IfModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule
    ],
    templateUrl: './redeem-invite-dialog.component.html',
    styleUrls: ['./redeem-invite-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'invite' }, InviteValidator]
})
export class RedeemInviteDialogComponent implements OnInit, OnDestroy {
    private translocoService = inject(TranslocoService);
    private inviteValidator = inject(InviteValidator);
    private registerService = inject(RegisterService);
    dialogRef = inject(MatDialogRef<RedeemInviteDialogComponent>);
    control = new FormControl('', {
        validators: Validators.compose([
            Validators.required,
            Validators.pattern(/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi)
        ]),
        asyncValidators: [this.inviteValidator.validate.bind(this.inviteValidator)]
    });
    loading$: Observable<boolean> = this.registerService.select('inviteStatus').pipe(map(status => status === InviteStatus.Redeeming));
    pending$: Observable<boolean> = this.control.statusChanges.pipe(
        map(status => status === 'PENDING'),
        startWith(this.control.pending)
    );
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();

    get errorMessage() {
        if (this.control.errors) {
            const [key, value] = Object.entries(this.control.errors)[0];
            return this.translocoService.translate(`invite.invite.errors.${key}`, { ...value });
        }

        return '';
    }

    constructor() {
        addFASvgIcons(['envelope'], 'far');
    }

    ngOnInit(): void {
        this.registerService
            .select('inviteStatus')
            .pipe(
                filter(status => status === InviteStatus.Redeemed),
                takeUntil(this.destroyed)
            )
            .subscribe(() => this.dialogRef.close());
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }

    handleRedeem(event: MouseEvent) {
        this.registerService.redeemInvite(this.control.value ?? '');
    }
}
