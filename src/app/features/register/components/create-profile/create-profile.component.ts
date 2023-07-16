import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toNullable } from '@dfinity/utils';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { EMPTY, Observable, map, shareReplay, startWith } from 'rxjs';

import { AvatarEditorComponent } from '@core/components/avatar-editor/avatar-editor.component';
import { addFASvgIcons } from '@core/utils';
import { UniqueUsernameValidator } from '@core/validators';
import { RegisterService, ProfileStatus } from '@features/register/services/register.service';

@Component({
    selector: 'app-create-profile',
    standalone: true,
    templateUrl: './create-profile.component.html',
    styleUrls: ['./create-profile.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [RegisterService, UniqueUsernameValidator],
    imports: [
        TranslocoModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        RxIf,
        RxPush,
        MatIconModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        AvatarEditorComponent
    ]
})
export class CreateProfileComponent {
    #registerService = inject(RegisterService);
    private translocoService = inject(TranslocoService);
    #uniqueUsernameValidator = inject(UniqueUsernameValidator);
    private fb = inject(FormBuilder);
    registerForm = this.fb.group({
        avatarUrl: new FormControl(),
        username: new FormControl('', {
            validators: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(20), Validators.pattern('[a-zA-Z0-9_]+')]),
            asyncValidators: [this.#uniqueUsernameValidator.validate.bind(this.#uniqueUsernameValidator)]
        }),
        displayName: new FormControl('')
    });
    unregistered: Signal<boolean> = computed(() => this.#registerService.profileStatus() === ProfileStatus.Unregistered);
    loading: Signal<boolean> = computed(() => this.#registerService.profileStatus() === ProfileStatus.Creating);
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

    get username() {
        return this.registerForm.get('username');
    }

    get displayName() {
        return this.registerForm.get('displayName');
    }

    get usernameErrorMessage() {
        if (this.username?.errors) {
            const [key, value] = Object.entries(this.username.errors)[0];
            return this.translocoService.translate(`createProfile.username.errors.${key}`, { ...value });
        }

        return '';
    }

    register() {
        const { avatarUrl, username, displayName } = this.registerForm.getRawValue();
        if (username) {
            this.#registerService.createProfile({ username, displayName: displayName ?? '', avatarUrl: toNullable(avatarUrl) });
        }
    }

    constructor() {
        addFASvgIcons(['user-plus'], 'far');
    }
}
