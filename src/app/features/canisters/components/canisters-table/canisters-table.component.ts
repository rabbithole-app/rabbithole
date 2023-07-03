import { animate, state, style, transition, trigger } from '@angular/animations';
import { SelectionModel } from '@angular/cdk/collections';
import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@ngneat/transloco';
import { RxFor } from '@rx-angular/template/for';

import { CopyIDComponent } from '@core/components/copy-id/copy-id.component';
import { EmptyComponent } from '@core/components/empty/empty.component';
import { addFASvgIcons } from '@core/utils';
import { CanisterDetails } from '@features/canisters/models';

@Component({
    selector: 'app-canisters-table',
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
        MatTooltipModule,
        MatProgressSpinnerModule,
        RxFor,
        TranslocoModule,
        CopyIDComponent
    ],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0' })),
            state('expanded', style({ height: '*' })),
            transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
        ])
    ],
    templateUrl: './canisters-table.component.html',
    styleUrls: ['./canisters-table.component.scss']
})
export class CanistersTableComponent {
    @Input() set data(value: CanisterDetails[]) {
        this.dataSource = new MatTableDataSource(value);
    }
    @Output() action: EventEmitter<{ type: string; id: string }> = new EventEmitter();
    dataSource = new MatTableDataSource<CanisterDetails>([]);
    columnsToDisplay: (keyof CanisterDetails | 'actions')[] = ['id', 'cycles', 'memorySize', 'freezingThresholdInCycles'];
    columnsToDisplayWithExpand = [...this.columnsToDisplay, 'actions'];
    expanded: SelectionModel<string> = new SelectionModel(false);

    constructor() {
        addFASvgIcons(['circle-info', 'angle-up', 'angle-down'], 'far');
    }

    handleExpand(event: MouseEvent, id: string) {
        event.stopPropagation();
        if (this.expanded.isSelected(id)) {
            this.expanded.deselect(id);
        } else {
            this.expanded.select(id);
        }
    }
}
