import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@ngneat/transloco';
import { selectSlice } from '@rx-angular/state/selections';
import { RxPush } from '@rx-angular/template/push';
import { Observable, map } from 'rxjs';

import { addFASvgIcons } from '@core/utils';
import { CreateInviteDialogComponent } from './components/create-invite-dialog/create-invite-dialog.component';
import { InvitesTableComponent } from './components/invites-table/invites-table.component';
import { Invite } from './models';
import { InvitationsService } from './services/invitations.service';
import { prepareInvite } from './utils';

@Component({
    selector: 'app-invitations',
    standalone: true,
    imports: [NgIf, TranslocoModule, InvitesTableComponent, MatButtonModule, MatDialogModule, MatProgressSpinnerModule, MatIconModule, RxPush],
    templateUrl: './invitations.component.html',
    styleUrls: ['./invitations.component.scss']
})
export class InvitationsComponent {
    private invitationsService = inject(InvitationsService);
    items$: Observable<Invite[]> = this.invitationsService
        .select(selectSlice(['items', 'deleting']))
        .pipe(map(({ items, deleting }) => items.map(item => ({ ...prepareInvite(item), loading: deleting[item.id] ?? false }))));
    create$: Observable<boolean> = this.invitationsService.select('loading', 'create');
    dialog = inject(MatDialog);

    constructor() {
        addFASvgIcons(['envelope'], 'far');
    }

    handleCreate() {
        const dialogRef = this.dialog.open(CreateInviteDialogComponent, {
            width: '600px'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.invitationsService.create(result);
            }
        });
    }

    handleAction(action: { type: string; id: string }) {
        switch (action.type) {
            case 'delete': {
                this.invitationsService.delete(action.id);
                break;
            }
            default:
                break;
        }
    }
}
