import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { Observable, from, map, switchMap, toArray } from 'rxjs';

import { JournalService, SnackbarProgressService } from '@features/file-list/services';
import { CanistersTableComponent } from './components/canisters-table/canisters-table.component';
import { formatCanisterDetails } from './operators';
import { CanistersService } from './services';

@Component({
    selector: 'app-canisters',
    standalone: true,
    templateUrl: './canisters.component.html',
    styleUrls: ['./canisters.component.scss'],
    imports: [RxPush, RxIf, MatButtonModule, CanistersTableComponent, MatDialogModule, MatProgressSpinnerModule, TranslocoModule],
    providers: [JournalService, SnackbarProgressService, { provide: TRANSLOCO_SCOPE, useValue: 'canisters' }],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanistersComponent {
    canistersService = inject(CanistersService);
    journalService = inject(JournalService);
    journalStatus$ = this.canistersService.select('journal').pipe(
        formatCanisterDetails(),
        map(v => [v])
    );
    storageStatus$ = this.canistersService.select('storages').pipe(switchMap(value => from(value).pipe(formatCanisterDetails(), toArray())));
    journalLoading$: Observable<boolean> = this.canistersService.select('journalLoading');
    storagesLoading$: Observable<boolean> = this.canistersService.select('storagesLoading');

    handleAction(event: { type: string; id: string }) {
        switch (event.type) {
            case 'delete': {
                // this.journalService.deleteStorage(event.id);
                break;
            }
            default: {
                throw new Error('Action not implemented.');
            }
        }
    }
}
