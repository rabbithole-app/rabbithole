import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Signal, WritableSignal, booleanAttribute, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
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
        NgClass,
        NgTemplateOutlet,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        TranslocoModule,
        CopyIDComponent,
        CanisterCardParamComponent,
        MatDividerModule,
        MatChipsModule
    ],
    templateUrl: './canister-card.component.html',
    styleUrls: ['./canister-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanisterCardComponent {
    @Input({
        required: true
    })
    data!: CanisterStatusResult;
    #canisterService = inject(CanisterService);
    loading: Signal<boolean> = computed(() => this.#canisterService.loading()[this.data.canisterId] ?? false);
    @Input({ transform: booleanAttribute }) disableDelete = false;
    expanded: WritableSignal<boolean> = signal(false);

    constructor() {
        addFASvgIcons(['circle-info', 'triangle-exclamation'], 'far');
    }

    hasError(data: CanisterStatusResult): data is CanisterStatusFailed {
        return has(data, 'errorMessage');
    }

    hasStatus(data: CanisterStatusResult): data is CanisterStatusSuccess {
        return has(data, 'canisterStatusResponse');
    }

    delete() {
        this.#canisterService.delete(this.data.canisterId);
    }

    toggle() {
        this.expanded.update(value => !value);
    }
}
