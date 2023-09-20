import { ChangeDetectionStrategy, Component, OnDestroy, Signal, computed, effect, inject } from '@angular/core';
import { TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { RxFor } from '@rx-angular/template/for';

import { CoreService } from '@core/services';
import { CanisterCardComponent } from './components/canister-card/canister-card.component';
import { EmptyCardComponent } from './components/empty-card/empty-card.component';
import { CanisterStatusResult } from './models';
import { CanisterService } from './services';

@Component({
    selector: 'app-canisters',
    standalone: true,
    imports: [RxIf, RxFor, TranslocoModule, CanisterCardComponent, EmptyCardComponent],
    templateUrl: './canisters.component.html',
    styleUrls: ['./canisters.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanistersComponent implements OnDestroy {
    readonly #coreService = inject(CoreService);
    #canisterService = inject(CanisterService);
    journals: Signal<CanisterStatusResult[]> = computed(() => this.#canisterService.canisters().filter(({ type }) => type === 'journal'));
    storages: Signal<CanisterStatusResult[]> = computed(() => this.#canisterService.canisters().filter(({ type }) => type === 'storage'));

    constructor() {
        effect(() => {
            const worker = this.#coreService.worker();
            if (this.#coreService.workerInited() && worker) {
                worker.postMessage({ action: 'startCanistersTimer' });
            }
        });
    }

    ngOnDestroy(): void {
        const worker = this.#coreService.worker();
        if (worker) {
            worker.postMessage({ action: 'stopCanistersTimer' });
        }
    }
}
