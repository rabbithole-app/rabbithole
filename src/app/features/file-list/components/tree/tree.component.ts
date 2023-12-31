import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, TrackByFunction } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRipple, MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTreeModule } from '@angular/material/tree';
import { RxIf } from '@rx-angular/template/if';
import { isEmpty } from 'lodash';

import { addFASvgIcons } from '@core/utils';
import { TreeDataSource, TreeDataSourceOptions } from './tree.datasource';
import { DirectoryFlatNode } from './tree.models';

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
    @Input({ required: true }) paths: string[] = [];
    @Input() expandPaths: string[] = [];
    @Input() disableSubtree = false;
    @Input() disableParent = true;
    @Output() selectPath = new EventEmitter<{ id: string; path: string } | null>();
    selected: SelectionModel<string> = new SelectionModel<string>(false);
    getLevel = (node: DirectoryFlatNode) => node.level;
    isExpandable = (node: DirectoryFlatNode) => node.expandable;
    treeControl: FlatTreeControl<DirectoryFlatNode, string> = new FlatTreeControl<DirectoryFlatNode, string>(this.getLevel, this.isExpandable, {
        trackBy: node => node.directory.id
    });
    dataSource = new TreeDataSource(this.treeControl, {
        paths: this.paths,
        expandPaths: this.expandPaths,
        disableSubtree: this.disableSubtree,
        disableParent: this.disableParent
    });
    hasChild = (_: number, node: DirectoryFlatNode) => node.expandable;
    trackById: TrackByFunction<DirectoryFlatNode> = (index: number, node: DirectoryFlatNode) => JSON.stringify(node);

    constructor() {
        addFASvgIcons(['folder-open', 'folder-closed', 'angle-right', 'angle-down'], 'far');
    }

    ngOnChanges(changes: SimpleChanges): void {
        const opts: TreeDataSourceOptions = {};
        if (changes['paths']) {
            opts.paths = changes['paths'].currentValue;
        }

        if (changes['expandPaths']) {
            opts.expandPaths = changes['expandPaths'].currentValue;
        }

        if (changes['disableSubtree']) {
            opts.disableSubtree = changes['disableSubtree'].currentValue;
        }

        if (changes['disableParent']) {
            opts.disableParent = changes['disableParent'].currentValue;
        }

        if (!isEmpty(opts)) {
            this.dataSource.setOptions(opts);
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
        if (node.disabled) this.selected.clear();
        else this.selected.select(id);
        this.selectPath.emit(this.selected.hasValue() ? { id, path } : null);
    }
}
