import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { WritableSignal, effect, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subscription, firstValueFrom, from, merge } from 'rxjs';
import { concatMap, filter, switchMap } from 'rxjs/operators';

import { JournalService } from '@features/file-list/services';
import { DirectoryFlatNode } from './tree.models';

export type TreeDataSourceOptions = { paths?: string[]; expandPaths?: string[]; disableSubtree?: boolean; disableParent?: boolean };

export class TreeDataSource implements DataSource<DirectoryFlatNode> {
    #rootNode = {
        directory: {
            name: 'My Drive',
            id: undefined
        },
        level: 0,
        expandable: true,
        loading: false,
        disabled: false
    } as unknown as DirectoryFlatNode;
    #data: WritableSignal<DirectoryFlatNode[]> = signal([this.#rootNode]);
    #data$ = toObservable(this.#data);
    #journalService = inject(JournalService);
    #treeSubscription!: Subscription;
    #options: WritableSignal<Required<TreeDataSourceOptions>> = signal({
        paths: [],
        expandPaths: [],
        disableSubtree: false,
        disableParent: true
    });

    constructor(
        private treeControl: FlatTreeControl<DirectoryFlatNode, string>,
        private options: TreeDataSourceOptions
    ) {
        this.#options.update(value => ({ ...value, ...options }));
        effect(() => {
            const data = this.#data();
            this.treeControl.dataNodes = data;
        });
        effect(() => {
            const { paths, expandPaths } = this.#options();
            [...paths, ...expandPaths].forEach(path => this.expandPath(path));
        });
    }

    connect(collectionViewer: CollectionViewer): Observable<DirectoryFlatNode[]> {
        this.#treeSubscription = this.treeControl.expansionModel.changed
            .pipe(
                filter(change => change.added.length > 0 || change.removed.length > 0),
                concatMap(change =>
                    merge(
                        from(change.added).pipe(concatMap(id => from(this.#toggleNode(id, true)))),
                        from(change.removed.slice().reverse()).pipe(concatMap(id => from(this.#toggleNode(id, false))))
                    )
                )
            )
            .subscribe();
        this.treeControl.expand(this.#rootNode);
        return merge(collectionViewer.viewChange.pipe(switchMap(() => this.#data$)), this.#data$);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    disconnect(collectionViewer: CollectionViewer): void {
        this.#treeSubscription.unsubscribe();
    }

    setOptions(options: TreeDataSourceOptions) {
        this.#options.update(value => ({ ...value, ...options }));
        this.#data.update(data => data.map(node => ({ ...node, disabled: this.#isDisabled(node.directory) })));
    }

    #isDisabled(directory: DirectoryFlatNode['directory']): boolean {
        const { paths, disableParent, disableSubtree } = this.#options();
        return (
            paths.includes(directory.path) ||
            (disableParent && paths.some(path => directory.path === (path.split('/').slice(0, -1).join('/') || undefined))) ||
            (disableSubtree && paths.some(path => directory.path?.startsWith(`${path}/`)))
        );
    }

    /**
     * Toggle the node, remove from display list
     */
    async #toggleNode(nodeId: string, expand: boolean) {
        const data = this.#data();
        const index = data.findIndex(({ directory }) => directory.id === nodeId);
        if (index === -1) return;
        if (expand) {
            this.#updateNode(nodeId, { loading: true });
            const children = await firstValueFrom(this.#journalService.get(nodeId));

            if (!children.length) {
                // If no children, or cannot find the node, no op
                this.#updateNode(nodeId, { loading: false });
                return;
            }

            const nodes = children.map(partialNode => {
                return {
                    ...partialNode,
                    level: data[index].level + 1,
                    loading: false,
                    disabled: this.#isDisabled(partialNode.directory)
                } as DirectoryFlatNode;
            });
            data.splice(index + 1, 0, ...nodes);
        } else {
            let count = 0;
            // eslint-disable-next-line no-empty
            for (let i = index + 1; i < data.length && data[i].level > data[index].level; i++, count++) {}
            const removed = data.splice(index + 1, count);
            const deselect = removed.filter(({ directory }) => this.treeControl.expansionModel.isSelected(directory.id)).map(node => node.directory.id);
            if (deselect.length) {
                this.treeControl.expansionModel.deselect(...deselect);
            }
        }

        this.#data.update(() =>
            data.map(node => {
                if (node.directory.id === nodeId) return { ...node, loading: false };
                return node;
            })
        );
    }

    async expandPath(path?: string) {
        const index = this.#data().findIndex(({ directory }) => directory.path === path);
        if (index === -1) {
            const breadcrumbs = await firstValueFrom(this.#journalService.getBreadcrumbs(path));
            this.treeControl.expansionModel.select(...breadcrumbs.map(({ id }) => id));
        }
    }

    #updateNode(id: string, value: Partial<DirectoryFlatNode>) {
        this.#data.update(data =>
            data.map(node => {
                if (node.directory.id === id) return { ...node, ...value };
                return node;
            })
        );
    }
}
