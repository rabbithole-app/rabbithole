import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { AfterViewInit, Component, ContentChild, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatNoDataRow, MatTable, MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@ngneat/transloco';
import { TranslocoLocaleModule, TranslocoLocaleService } from '@ngneat/transloco-locale';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

import { CopyIDComponent } from '@core/components/copy-id/copy-id.component';
import { EmptyComponent } from '@core/components/empty/empty.component';
import { RabbitholePaginatorIntl } from '@core/i18n/paginator';
import { addFASvgIcons } from '@core/utils';
import { Invite } from '@features/invitations/models';

@Component({
    selector: 'app-invites-table',
    standalone: true,
    imports: [
        NgIf,
        NgSwitch,
        NgSwitchCase,
        NgSwitchDefault,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        EmptyComponent,
        MatSnackBarModule,
        MatTooltipModule,
        MatPaginatorModule,
        MatSortModule,
        MatProgressSpinnerModule,
        TranslocoModule,
        TranslocoLocaleModule,
        CopyIDComponent
    ],
    templateUrl: './invites-table.component.html',
    styleUrls: ['./invites-table.component.scss'],
    providers: [{ provide: MatPaginatorIntl, useClass: RabbitholePaginatorIntl }]
})
export class InvitesTableComponent implements AfterViewInit {
    private translocoLocaleService = inject(TranslocoLocaleService);
    @ContentChild(MatNoDataRow) noDataRow!: MatNoDataRow;
    @ViewChild(MatTable) table!: MatTable<Invite>;
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;
    dataSource = new MatTableDataSource<Invite>([]);

    @Input() set data(value: Invite[]) {
        this.dataSource = new MatTableDataSource(value);
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }
    @Output() action: EventEmitter<{ type: string; id: string }> = new EventEmitter();
    displayedColumns: (keyof Invite | 'actions')[] = ['id', 'cycles', 'status', 'createdAt', 'expiredAt', 'actions'];

    constructor() {
        addFASvgIcons(['circle-info', 'trash-can'], 'far');
    }

    ngAfterViewInit(): void {
        this.table.setNoDataRow(this.noDataRow);
    }

    getDateDistance(date: Date): string {
        switch (this.translocoLocaleService.getLocale()) {
            case 'ru-RU':
                return formatDistanceToNow(date, { locale: ru });
            default:
                return formatDistanceToNow(date);
        }
    }
}
