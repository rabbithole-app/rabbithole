import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { BreadcrumbsComponent } from '@features/file-list/components/breadcrumbs/breadcrumbs.component';
import { FileListService } from '@features/file-list/services/file-list.service';

@Component({
    selector: 'app-page-header',
    templateUrl: './page-header.component.html',
    styleUrls: ['./page-header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgSwitch, NgSwitchCase, NgSwitchDefault, BreadcrumbsComponent],
    standalone: true
})
export class PageHeaderComponent {
    readonly #fileListService = inject(FileListService);
    readonly hasBreadcrumbs: Signal<boolean> = computed(() => this.#fileListService.breadcrumbs().length > 0);
}
