import { NgIf } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateFnsAdapter, MatDateFnsModule } from '@angular/material-date-fns-adapter';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { add, startOfTomorrow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { AsyncSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { DATE_FORMATS } from '@core/config';

@Component({
    selector: 'app-create-add-invite-dialog',
    standalone: true,
    imports: [NgIf, MatButtonModule, MatDialogModule, TranslocoModule, MatInputModule, MatDatepickerModule, MatDateFnsModule, ReactiveFormsModule],
    templateUrl: './create-invite-dialog.component.html',
    styleUrls: ['./create-invite-dialog.component.scss'],
    providers: [
        { provide: MAT_DATE_LOCALE, useValue: enUS },
        {
            provide: DateAdapter,
            useClass: DateFnsAdapter,
            deps: [MAT_DATE_LOCALE]
        },
        { provide: MAT_DATE_FORMATS, useValue: DATE_FORMATS }
    ]
})
export class CreateInviteDialogComponent implements OnInit, OnDestroy {
    private locale: Locale = inject(MAT_DATE_LOCALE);
    private adapter = inject(DateAdapter);
    dialogRef = inject(MatDialogRef<CreateInviteDialogComponent>);
    private translocoService = inject(TranslocoService);
    private destroyed: AsyncSubject<void> = new AsyncSubject();
    minDate = startOfTomorrow();
    maxDate = add(this.minDate, { months: 1 });
    dateControl = new FormControl(add(this.minDate, { weeks: 1 }), [Validators.required]);

    ngOnInit(): void {
        this.translocoService.langChanges$.pipe(takeUntil(this.destroyed)).subscribe(lang => {
            switch (lang) {
                case 'ru': {
                    this.locale = ru;
                    this.adapter.setLocale(ru);
                    break;
                }
                default: {
                    this.locale = enUS;
                    this.adapter.setLocale(enUS);
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }

    handleClose() {
        this.dialogRef.close();
    }

    getDateFormatString(): string {
        if (this.locale.code === 'en-US') {
            return 'DD/MM/YYYY';
        } else if (this.locale.code === 'ru') {
            return 'DD.MM.YYYY';
        }
        return '';
    }
}
