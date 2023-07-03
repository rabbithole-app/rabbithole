import { ChangeDetectionStrategy, Component, Inject, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@ngneat/transloco';
import { compact, uniq } from 'lodash';

import { JournalItem } from '@features/file-list/models';
import { JournalService } from '@features/file-list/services';
import { TreeComponent } from '../tree/tree.component';

enum ItemsType {
    File,
    Folder,
    Mixed
}

@Component({
    selector: 'app-move-dialog',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule, TranslocoModule, TreeComponent],
    templateUrl: './move-dialog.component.html',
    styleUrls: ['./move-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MoveDialogComponent {
    readonly #journalService = inject(JournalService);
    items: WritableSignal<JournalItem[]> = signal([]);
    paths: Signal<string[]> = computed(() => this.items().map(({ path }) => path));
    expandPaths: Signal<string[]> = computed(() =>
        compact(
            uniq(
                this.items()
                    .filter(this.#journalService.isFile)
                    .map(({ path }) => path.split('/').slice(0, -1).join('/'))
            )
        )
    );
    itemsType: Signal<ItemsType> = computed(() => {
        const items = this.items();
        if (items.every(i => i.type === 'folder')) return ItemsType.Folder;
        else if (items.every(i => i.type === 'file')) return ItemsType.File;
        else return ItemsType.Mixed;
    });
    disableSubtree: Signal<boolean> = computed(() => this.itemsType() !== ItemsType.File);
    disableParent: Signal<boolean> = computed(() => this.itemsType() === ItemsType.File);
    selected: WritableSignal<{ id: string; path: string } | null> = signal(null);

    constructor(@Inject(MAT_DIALOG_DATA) public readonly data: { items: JournalItem[] }) {
        this.items.set(data.items);
    }
}
