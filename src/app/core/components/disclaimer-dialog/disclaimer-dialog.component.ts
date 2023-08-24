import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@ngneat/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-disclaimer-dialog',
    standalone: true,
    imports: [MatDialogModule, TranslocoModule, MatButtonModule, MatCheckboxModule, FormsModule],
    template: `
        <ng-container *transloco="let t; read: 'application.disclaimer'">
            <h1 mat-dialog-title>{{ t('title') }}</h1>
            <mat-dialog-content class="mat-typography">
                <p [innerHTML]="t('description')"></p>
                <mat-checkbox color="primary" [(ngModel)]="checked">{{ t('checkbox') }}</mat-checkbox>
            </mat-dialog-content>
            <mat-dialog-actions align="end">
                <button mat-button [mat-dialog-close]="checked">{{ t('actions.close') }}</button>
            </mat-dialog-actions>
        </ng-container>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DisclaimerDialogComponent {
    checked = false;
}
