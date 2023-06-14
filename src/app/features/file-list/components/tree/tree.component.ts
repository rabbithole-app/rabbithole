import { FlatTreeControl } from '@angular/cdk/tree';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, TrackByFunction } from '@angular/core';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RxIf } from '@rx-angular/template/if';
import { NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet } from '@angular/common';
import { SelectionModel } from '@angular/cdk/collections';
import { MatRipple, MatRippleModule } from '@angular/material/core';

import { addFASvgIcons } from '@core/utils';
import { DirectoryFlatNode } from './tree.models';
import { TreeDataSource } from './tree.datasource';

@Component({
    selector: 'app-tree',
    templateUrl: './tree.component.html',
    styleUrls: ['./tree.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        RxIf,
        NgTemplateOutlet,
        NgSwitch,
        NgSwitchCase,
        NgSwitchDefault,
        MatTreeModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatRippleModule
    ],
    providers: []
})
export class TreeComponent implements OnChanges {
    @Input({ required: true }) path!: string;
    @Input() disableSubtree = false;
    @Output() selectPath = new EventEmitter<{ id: string; path: string } | null>();
    selected: SelectionModel<string> = new SelectionModel<string>(false);
    getLevel = (node: DirectoryFlatNode) => node.level;
    isExpandable = (node: DirectoryFlatNode) => node.expandable;
    treeControl: FlatTreeControl<DirectoryFlatNode, string> = new FlatTreeControl<DirectoryFlatNode, string>(this.getLevel, this.isExpandable, {
        trackBy: node => node.directory.id
    });
    dataSource = new TreeDataSource(this.treeControl, this.path, this.disableSubtree);
    hasChild = (_: number, node: DirectoryFlatNode) => node.expandable;
    trackById: TrackByFunction<DirectoryFlatNode> = (index: number, node: DirectoryFlatNode) => JSON.stringify(node);

    constructor() {
        addFASvgIcons(['folder-open', 'folder-closed', 'angle-right', 'angle-down'], 'far');
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['path']) {
            const path = changes['path'].currentValue;
            this.dataSource.setOptions({ path });
        }

        if (changes['disableSubtree']) {
            const disableSubtree = changes['disableSubtree'].currentValue;
            this.dataSource.setOptions({ disableSubtree });
        }

        if (typeof this.path !== 'string') {
            throw new TypeError('The input `path` is required');
        }
    }

    handleSelect(event: MouseEvent, node: DirectoryFlatNode, ripple: MatRipple): void {
        if (ripple && !node.disabled) {
            const rippleRef = ripple.launch(event.pageX, event.pageY, {
                persistent: true,
                animation: {
                    enterDuration: 250,
                    exitDuration: 250
                }
            });

            rippleRef.fadeOut();
        }
        const { id, path } = node.directory;
        if (this.path === path) return;
        this.selected.select(id);
        this.selectPath.emit(id && path ? { id, path } : null);
    }
}
