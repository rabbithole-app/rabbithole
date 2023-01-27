import { Component, OnInit, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AsyncSubject, EMPTY, filter, iif, Observable, of, shareReplay } from 'rxjs';
import { map, startWith, switchMap, take, takeUntil } from 'rxjs/operators';
import { isNull } from 'lodash';

// import { ProfileCreate } from '@declarations/rabbithole/rabbithole.did';
import { addFASvgIcons } from '@core/utils';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
    selector: 'app-create-profile',
    templateUrl: './create-profile.component.html',
    styleUrls: ['./create-profile.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        MatProgressBarModule,
        MatCardModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        ReactiveFormsModule,
        TranslocoModule
    ]
})
export class CreateProfileComponent implements OnInit, OnDestroy {
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();
    createProfileForm = this.fb.group({
        username: new FormControl('', {
            validators: Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(20), Validators.pattern('[a-zA-Z0-9_]+')]),
            asyncValidators: Validators.composeAsync([
                /*this.profileService.checkUsernameAvailabilityValidator()*/
            ])
        }),
        displayName: new FormControl(''),
        avatar: new FormControl('')
    });
    usernameErrorMessages$: Observable<string[]> = EMPTY;
    loading$: Observable<boolean> = of(true);

    get username() {
        return this.createProfileForm.get('username');
    }

    get displayName() {
        return this.createProfileForm.get('displayName');
    }

    constructor(private fb: FormBuilder) {
        addFASvgIcons(['user-plus'], 'far');
    }

    ngOnInit(): void {
        if (this.username) {
            // this.username.statusChanges.pipe(takeUntil(this.destroyed)).subscribe(() => this.cdr.markForCheck());
            this.usernameErrorMessages$ = this.username.valueChanges.pipe(
                // ждем выполнения асинхронных валидаторов
                switchMap(() => {
                    if (!this.username) {
                        return EMPTY;
                    }

                    return this.username.statusChanges.pipe(
                        startWith(this.username?.status),
                        filter(status => status !== 'PENDING'),
                        take(1)
                    );
                }),
                switchMap(errors =>
                    iif(
                        () => isNull(this.username?.errors),
                        of([]),
                        of(this.username?.errors as ValidationErrors).pipe(
                            /*map(errors =>
                                Object.entries(errors).map(([key, value]) =>
                                    this.translateService.instant(
                                        `profile.create.username.errors.${key}`,
                                        key.endsWith('length') ? { [key]: value.requiredLength } : undefined
                                    )
                                )
                            )*/
                            map(() => [])
                        )
                    )
                ),
                shareReplay(1)
            );
        }
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }

    create() {
        // this.store.dispatch(createProfile({ profile: this.createProfileForm.value as ProfileCreate }));
    }
}
