import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoModule } from '@ngneat/transloco';
import { selectSlice } from '@rx-angular/state/selections';
import { AsyncSubject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import { ROUTE_ANIMATIONS_ELEMENTS } from '@core/animations';
import { SETTINGS_RX_STATE, SettingsState } from '@core/stores';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, MatFormFieldModule, MatSelectModule, MatOptionModule, ReactiveFormsModule, TranslocoModule, MatSlideToggleModule],
    standalone: true
})
export class SettingsComponent implements OnInit, OnDestroy {
    readonly routeAnimationsElements = ROUTE_ANIMATIONS_ELEMENTS;
    readonly themes = [
        { value: 'light-theme', label: 'Light' },
        { value: 'dark-theme', label: 'Dark' }
    ];
    readonly languages = [
        { value: 'en', label: 'English' },
        { value: 'de', label: 'Deutsch', disabled: true },
        { value: 'ru', label: 'Русский', disabled: true }
    ];
    settingsState = inject(SETTINGS_RX_STATE);
    settingsForm = new FormGroup({
        language: new FormControl('en'),
        theme: new FormControl({ value: 'light-theme', disabled: true }),
        expertMode: new FormControl(false)
    });
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();

    ngOnInit(): void {
        this.settingsState
            .select(selectSlice(['language', 'theme', 'expertMode']))
            .pipe(takeUntil(this.destroyed))
            .subscribe(state => {
                this.settingsForm.setValue(state, { emitEvent: false });
            });
        this.settingsForm.valueChanges
            .pipe(
                map(state => state as Partial<SettingsState>),
                takeUntil(this.destroyed)
            )
            .subscribe(state => this.settingsState.set(state));
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }
}
