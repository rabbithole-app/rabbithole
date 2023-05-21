import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { MatButtonModule } from '@angular/material/button';
import { PushPipe } from '@rx-angular/template/push';
import { RxIf } from '@rx-angular/template/if';
import { from, map, Observable, switchMap, toArray } from 'rxjs';

import { CanistersService } from './services';
import { CanistersTableComponent } from './components/canisters-table/canisters-table.component';
import { formatCanisterDetails } from './operators';
import { JournalService, SnackbarProgressService } from '@features/file-list/services';

@Component({
    selector: 'app-canisters',
    standalone: true,
    templateUrl: './canisters.component.html',
    styleUrls: ['./canisters.component.scss'],
    imports: [PushPipe, RxIf, MatButtonModule, CanistersTableComponent, MatDialogModule, MatProgressSpinnerModule, TranslocoModule],
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
