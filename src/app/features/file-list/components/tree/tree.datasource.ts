import { FlatTreeControl } from '@angular/cdk/tree';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Observable, Subscription, firstValueFrom, from, merge } from 'rxjs';
import { concatMap, filter, switchMap } from 'rxjs/operators';
import { WritableSignal, effect, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';

import { DirectoryFlatNode } from './tree.models';
import { JournalService } from '@features/file-list/services';

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

    constructor(private treeControl: FlatTreeControl<DirectoryFlatNode, string>, private path: string, private disableSubtree: boolean = false) {
        effect(() => {
            const data = this.#data();
            this.treeControl.dataNodes = data;
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

    setOptions(opts: { path?: string; disableSubtree?: boolean }) {
        if (opts.path) {
            this.path = opts.path;
            this.expandPath(this.path);
        }
        if (opts.disableSubtree) {
            this.disableSubtree = opts.disableSubtree;
        }

        const currentNode = this.#data().find(({ directory }) => directory.path === this.path);
        if (!currentNode) return;
        this.#data.update(data =>
            data.map(node => {
                if (node.directory.path === this.path || (this.disableSubtree && node.directory.path?.startsWith(`${this.path}/`))) {
                    return { ...node, disabled: true };
                }
                return { ...node, disabled: false };
            })
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
                const disabled = this.disableSubtree ? data[index].disabled : false;
                return {
                    ...partialNode,
                    level: data[index].level + 1,
                    loading: false,
                    disabled: partialNode.directory?.path === this.path || disabled
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
