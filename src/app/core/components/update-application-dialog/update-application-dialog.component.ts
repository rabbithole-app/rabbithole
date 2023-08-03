import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
    selector: 'app-update-application-dialog',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule, TranslocoModule],
    template: `
        <ng-container *transloco="let t; read: 'application.update'">
            <h1 mat-dialog-title>{{ t('title') }}</h1>
            <mat-dialog-content class="mat-typography">{{ t('description') }}</mat-dialog-content>
            <mat-dialog-actions align="end">
                <button mat-button mat-dialog-close>{{ t('cancel') }}</button>
                <button mat-raised-button color="primary" [mat-dialog-close]="true">{{ t('reload') }}</button>
            </mat-dialog-actions>
        </ng-container>
    `,
    styleUrls: [],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateApplicationDialogComponent {}
