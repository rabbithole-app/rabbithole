import { Injectable, Signal, inject } from '@angular/core';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { ProfileItem } from '@core/models/profile';
import { CoreService } from '@core/services';
import { SharedFileExtended } from '../models';

@Injectable({
    providedIn: 'root'
})
export class SharedWithMeService {
    readonly #coreService = inject(CoreService);
    items: Signal<{ user: ProfileItem; items: SharedFileExtended[] }[]> = toSignal(
        this.#coreService.workerMessage$.pipe(
            filter(({ data }) => data.action === 'sharedWithMeDone'),
            map(({ data }) => data.payload)
        ),
        { initialValue: [] }
    );
}
