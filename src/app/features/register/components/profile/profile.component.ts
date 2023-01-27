import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { IfModule } from '@rx-angular/template/if';
import { EMPTY, map, Observable, shareReplay, startWith } from 'rxjs';
import { PushModule } from '@rx-angular/template/push';

import { RegisterService, UserStatus } from '@features/register/services/register.service';
import { addFASvgIcons } from '@core/utils';
import { UniqueUsernameValidator } from '@core/validators';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        NgSwitch,
        NgSwitchCase,
        TranslocoModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        IfModule,
        PushModule,
        MatIconModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [RegisterService, { provide: TRANSLOCO_SCOPE, useValue: 'create-profile' }, UniqueUsernameValidator]
})
export class ProfileComponent {
    private registerService = inject(RegisterService);
    private translateService = inject(TranslocoService);
    uniquerUsernameValidator = inject(UniqueUsernameValidator);
    private fb = inject(FormBuilder);
    registerForm = this.fb.group({
        username: new FormControl('', {
            validators: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(20), Validators.pattern('[a-zA-Z0-9_]+')]),
            asyncValidators: [this.uniquerUsernameValidator.validate.bind(this.uniquerUsernameValidator)]
        }),
        displayName: new FormControl('')
    });
    userStatus$: Observable<UserStatus> = this.registerService.select('userStatus');
    disabled$: Observable<boolean> = this.registerForm.statusChanges.pipe(
        map(status => status === 'INVALID'),
        startWith(this.registerForm.invalid),
        shareReplay(1)
    );
    pending$: Observable<boolean> = this.username
        ? this.username.statusChanges.pipe(
              map(status => status === 'PENDING'),
              startWith(this.username.pending)
          )
        : EMPTY;
    readonly userStatus = UserStatus;

    get username() {
        return this.registerForm.get('username');
    }

    get displayName() {
        return this.registerForm.get('displayName');
    }

    get usernameErrorMessage() {
        if (this.username?.errors) {
            const [key, value] = Object.entries(this.username.errors)[0];
            return this.translateService.translate(`createProfile.username.errors.${key}`, { ...value });
        }

        return '';
    }

    register() {
        const { username, displayName } = this.registerForm.getRawValue();
        if (username) {
            this.registerService.createProfile({ username, displayName: displayName ?? '' });
        }
    }

    constructor() {
        addFASvgIcons(['user-plus'], 'far');
    }
}
