import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Signal, WritableSignal, booleanAttribute, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { RxFor } from '@rx-angular/template/for';
import { has } from 'lodash';

import { CopyIDComponent } from '@core/components/copy-id/copy-id.component';
import { addFASvgIcons } from '@core/utils';
import { CanisterStatusFailed, CanisterStatusResult, CanisterStatusSuccess } from '@features/canisters/models';
import { CanisterService } from '@features/canisters/services/canister.service';
import { CanisterCardParamComponent } from '../canister-card-param/canister-card-param.component';

@Component({
    selector: 'app-canister-card',
    standalone: true,
    imports: [
        RxIf,
        RxFor,
        NgTemplateOutlet,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        TranslocoModule,
        CopyIDComponent,
        CanisterCardParamComponent,
        MatDividerModule,
        MatChipsModule,
        MatProgressBarModule
    ],
    templateUrl: './canister-card.component.html',
    styleUrls: ['./canister-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanisterCardComponent {
    @Input({ required: true })
    set data(value: CanisterStatusResult) {
        this._data.set(value);
    }
    _data: WritableSignal<CanisterStatusResult> = signal(this.data);
    #canisterService = inject(CanisterService);

    hasStatus: Signal<boolean> = computed(() => has(this._data(), 'canisterStatusResponse'));
    hasError: Signal<boolean> = computed(() => has(this._data(), 'errorMessage'));
    status: Signal<CanisterStatusSuccess | null> = computed(() => {
        const data = this._data();
        return this.#hasStatus(data) ? data : null;
    });
    errorMessage: Signal<string | null> = computed(() => {
        const data = this._data();
        return this.#hasError(data) ? data.errorMessage : null;
    });
    deleting: Signal<boolean> = computed(() => {
        const canisterId = this.canisterId();
        return canisterId ? this.#canisterService.loading()[canisterId] : false;
    });
    loading: Signal<boolean> = computed(() => this.status()?.loading ?? false);
    @Input({ transform: booleanAttribute }) disableDelete = false;
    expanded: WritableSignal<boolean> = signal(false);
    canisterId: Signal<string | null> = computed(() => this._data()?.canisterId ?? null);

    constructor() {
        addFASvgIcons(['circle-info', 'triangle-exclamation'], 'far');
    }

    #hasError(data: CanisterStatusResult): data is CanisterStatusFailed {
        return has(data, 'errorMessage');
    }

    #hasStatus(data: CanisterStatusResult): data is CanisterStatusSuccess {
        return has(data, 'canisterStatusResponse');
    }

    delete() {
        const canisterId = this.canisterId();
        if (canisterId) this.#canisterService.delete(canisterId);
    }

    toggle() {
        this.expanded.update(value => !value);
    }
}
