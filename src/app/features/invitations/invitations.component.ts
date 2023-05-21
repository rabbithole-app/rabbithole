import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@ngneat/transloco';
import { map, Observable } from 'rxjs';
import { PushPipe } from '@rx-angular/template/push';
import { selectSlice } from '@rx-angular/state/selections';

import { InvitationsService } from './services/invitations.service';
import { InvitesTableComponent } from './components/invites-table/invites-table.component';
import { CreateInviteDialogComponent } from './components/create-invite-dialog/create-invite-dialog.component';
import { addFASvgIcons } from '@core/utils';
import { Invite } from './models';
import { prepareInvite } from './utils';

@Component({
    selector: 'app-invitations',
    standalone: true,
    imports: [NgIf, TranslocoModule, InvitesTableComponent, MatButtonModule, MatDialogModule, MatProgressSpinnerModule, MatIconModule, PushPipe],
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

    handleCreate(event: MouseEvent) {
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
