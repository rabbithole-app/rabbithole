import { ChangeDetectionStrategy, Component, computed, effect, inject, Signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TRANSLOCO_SCOPE, TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { map, Observable, startWith } from 'rxjs';

import { addFASvgIcons } from '@core/utils';
import { InviteValidator } from '@core/validators';
import { InviteStatus, RegisterService } from '@features/register/services/register.service';

@Component({
    selector: 'app-redeem-invite-dialog',
    standalone: true,
    imports: [
        MatFormFieldModule,
        TranslocoModule,
        MatInputModule,
        ReactiveFormsModule,
        RxIf,
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
export class RedeemInviteDialogComponent {
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
    loading: Signal<boolean> = computed(() => this.registerService.inviteStatus() === InviteStatus.Redeeming);
    pending$: Observable<boolean> = this.control.statusChanges.pipe(
        map(status => status === 'PENDING'),
        startWith(this.control.pending)
    );

    get errorMessage() {
        if (this.control.errors) {
            const [key, value] = Object.entries(this.control.errors)[0];
            return this.translocoService.translate(`invite.invite.errors.${key}`, { ...value });
        }

        return '';
    }

    constructor() {
        addFASvgIcons(['envelope'], 'far');
        effect(() => {
            if (this.registerService.inviteStatus() === InviteStatus.Redeemed) {
                this.dialogRef.close();
            }
        });
    }

    handleRedeem() {
        this.registerService.redeemInvite(this.control.value ?? '');
    }
}
