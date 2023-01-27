import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { map, Observable } from 'rxjs';
import { PushModule } from '@rx-angular/template/push';
import { selectSlice } from '@rx-angular/state/selections';

import { InvitesService } from './services/invites.service';
import { InvitesTableComponent } from './components/invites-table/invites-table.component';
import { CreateInviteDialogComponent } from './components/create-invite-dialog/create-invite-dialog.component';
import { addFASvgIcons } from '@core/utils';
import { Invite } from './models';
import { prepareInvite } from './utils';

@Component({
    selector: 'app-invites',
    standalone: true,
    imports: [NgIf, TranslocoModule, InvitesTableComponent, MatButtonModule, MatDialogModule, MatProgressSpinnerModule, MatIconModule, PushModule],
    templateUrl: './invites.component.html',
    styleUrls: ['./invites.component.scss'],
    providers: [
        {
            provide: TRANSLOCO_SCOPE,
            useValue: 'invites'
        }
    ]
})
export class InvitesComponent {
    private invitesService = inject(InvitesService);
    items$: Observable<Invite[]> = this.invitesService
        .select(selectSlice(['items', 'deleting']))
        .pipe(map(({ items, deleting }) => items.map(item => ({ ...prepareInvite(item), loading: deleting[item.id] ?? false }))));
    create$: Observable<boolean> = this.invitesService.select('loading', 'create');
    dialog = inject(MatDialog);

    constructor() {
        addFASvgIcons(['envelope'], 'far');
    }

    handleCreate(event: MouseEvent) {
        const dialogRef = this.dialog.open(CreateInviteDialogComponent, {
            width: '600px'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.invitesService.create(result);
            }
        });
    }

    handleAction(action: { type: string; id: string }) {
        switch (action.type) {
            case 'delete': {
                this.invitesService.delete(action.id);
                break;
            }
            default:
                break;
        }
    }
}
