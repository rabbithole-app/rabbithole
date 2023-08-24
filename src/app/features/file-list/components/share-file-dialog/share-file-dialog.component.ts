import { ClipboardModule, Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { Principal } from '@dfinity/principal';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { enUS, ru } from 'date-fns/locale';
import { has, isUndefined } from 'lodash';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { add, startOfTomorrow } from 'date-fns';
import { fromNullable } from '@dfinity/utils';

import { NotificationService } from '@core/services';
import { SelectUsersComponent } from '@core/components/select-users/select-users.component';
import { DATE_FORMATS } from '@core/config';
import { AUTH_RX_STATE } from '@core/stores';
import { addFASvgIcons, fromTimestamp } from '@core/utils';
import { FileShare } from '@declarations/journal/journal.did';
import { FileInfoExtended } from '@features/file-list/models';

@Component({
    selector: 'app-share-file-dialog',
    standalone: true,
    imports: [
        RxIf,
        RxFor,
        RxPush,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        TranslocoModule,
        SelectUsersComponent,
        MatSelectModule,
        MatSlideToggleModule,
        MatTabsModule,
        ClipboardModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatRadioModule,
        MatCheckboxModule,
        MatDatepickerModule
    ],
    templateUrl: './share-file-dialog.component.html',
    styleUrls: ['./share-file-dialog.component.scss'],
    providers: [
        { provide: MAT_DATE_LOCALE, useValue: enUS },
        {
            provide: DateAdapter,
            useClass: DateFnsAdapter,
            deps: [MAT_DATE_LOCALE]
        },
        { provide: MAT_DATE_FORMATS, useValue: DATE_FORMATS }
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareFileDialogComponent implements OnInit {
    readonly #fb = inject(FormBuilder);
    readonly #authState = inject(AUTH_RX_STATE);
    readonly #adapter = inject(DateAdapter);
    #notificationService = inject(NotificationService);
    #translocoService = inject(TranslocoService);
    #clipboard = inject(Clipboard);
    #destroyed = inject(DestroyRef);
    exceptList$: Observable<string[]> = this.#authState.select('identity').pipe(map(identity => [identity.getPrincipal().toText()]));
    readonly data = inject<{ item: FileInfoExtended; shareWith: 'users' | 'public' }>(MAT_DIALOG_DATA);
    readonly #dialogRef = inject<MatDialogRef<ShareFileDialogComponent>>(MatDialogRef);
    minDate = startOfTomorrow();
    form = this.#fb.group({
        with: new FormControl(this.data.shareWith),
        publicLink: new FormControl({ value: `${location.origin}/public/${this.data.item.id}`, disabled: true }),
        users: new FormControl(this.users, [Validators.required]),
        timelock: new FormControl(false),
        timelockDate: new FormControl(add(this.minDate, { days: 1 }), [Validators.required])
    });
    shareControl = new FormControl(false);

    #isSharedWithUsers(sharedWith: FileShare['sharedWith']): sharedWith is { users: Principal[] } {
        return has(sharedWith, 'users');
    }

    get users(): string[] | null {
        const share = this.data.item.share;
        if (share && this.#isSharedWithUsers(share.sharedWith)) {
            return share.sharedWith.users.map(p => p.toText());
        }

        return null;
    }

    get isShared(): boolean {
        return !isUndefined(this.data.item.share);
    }

    #locale: Locale = inject(MAT_DATE_LOCALE);

    constructor() {
        addFASvgIcons(['copy'], 'far');
        this.#translocoService.langChanges$.pipe(takeUntilDestroyed()).subscribe(lang => {
            switch (lang) {
                case 'ru': {
                    this.#locale = ru;
                    this.#adapter.setLocale(ru);
                    break;
                }
                default: {
                    this.#locale = enUS;
                    this.#adapter.setLocale(enUS);
                }
            }
        });
    }

    ngOnInit(): void {
        this.sharedWithControl?.valueChanges.pipe(startWith(this.data.shareWith), takeUntilDestroyed(this.#destroyed)).subscribe(value => {
            if (value === 'public') {
                this.form.removeControl('users' as never);
                this.form.addControl('publicLink', new FormControl({ value: `${location.origin}/public/${this.data.item.id}`, disabled: true }));
            } else if (value === 'users') {
                this.form.removeControl('publicLink' as never);
                this.form.addControl('users', new FormControl(this.users, [Validators.required]));
            }
        });
        const timelock = fromNullable(this.data.item.share?.timelock ?? []);
        const timelockDate = timelock ? fromTimestamp(timelock) : add(this.minDate, { days: 1 });
        this.timelockControl?.valueChanges.pipe(takeUntilDestroyed(this.#destroyed)).subscribe(enabled => {
            if (enabled) {
                this.form.addControl('timelockDate', new FormControl(timelockDate, [Validators.required]));
            } else {
                this.form.removeControl('timelockDate' as never);
            }
        });
        this.timelockControl?.setValue(!!timelock);
    }

    getDateFormatString(): string {
        if (this.#locale.code === 'en-US') {
            return 'DD/MM/YYYY';
        } else if (this.#locale.code === 'ru') {
            return 'DD.MM.YYYY';
        }
        return '';
    }

    copy(event: MouseEvent) {
        event.stopPropagation();
        this.#clipboard.copy(this.form.get('publicLink')?.value ?? '');
        this.#notificationService.success(this.#translocoService.translate('shared.messages.copied'));
    }

    handleShare() {
        const formValue = this.form.getRawValue();
        const timelock = formValue.timelock ? (formValue.timelockDate as NonNullable<Date>) : undefined;
        let data: {
            sharedWith: { everyone: null } | { users: Principal[] };
            limitDownloads?: number;
            timelock?: Date;
        } | null = null;
        if (formValue.with === 'public') {
            data = { sharedWith: { everyone: null }, timelock };
        } else if (formValue.with === 'users') {
            const users = formValue.users?.map(v => Principal.fromText(v));
            data = {
                sharedWith: { users: users as NonNullable<typeof users> },
                timelock
            };
        }
        this.#dialogRef.close({ share: data });
    }

    get usersControl() {
        return this.form.get('users');
    }

    get sharedWithControl() {
        return this.form.get('with');
    }

    get timelockControl() {
        return this.form.get('timelock');
    }

    get timelockDateControl() {
        return this.form.get('timelockDate');
    }
}
