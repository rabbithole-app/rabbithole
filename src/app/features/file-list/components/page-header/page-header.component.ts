import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RxState } from '@rx-angular/state';
import { map } from 'rxjs/operators';
import { FILE_LIST_RX_STATE } from '@features/file-list/file-list.store';
import { BreadcrumbsComponent } from '@features/file-list/components/breadcrumbs/breadcrumbs.component';

@Component({
    selector: 'app-page-header',
    templateUrl: './page-header.component.html',
    styleUrls: ['./page-header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, BreadcrumbsComponent],
    standalone: true,
    providers: [RxState]
})
export class PageHeaderComponent extends RxState<{ hasBreadcrumbs: boolean }> {
    private fileListState = inject(FILE_LIST_RX_STATE);

    constructor() {
        super();
        this.connect('hasBreadcrumbs', this.fileListState.select('breadcrumbs').pipe(map(items => items.length > 0)));
    }
}
