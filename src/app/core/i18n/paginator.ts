import { inject, Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@ngneat/transloco';
import { Subject } from 'rxjs';

@Injectable()
export class RabbitholePaginatorIntl implements MatPaginatorIntl {
    translateService = inject(TranslocoService);
    changes = new Subject<void>();
    firstPageLabel = this.translateService.translate('paginator.firstPageLabel');
    itemsPerPageLabel = this.translateService.translate('paginator.itemsPerPageLabel');
    lastPageLabel = this.translateService.translate('paginator.lastPageLabel');
    nextPageLabel = this.translateService.translate('paginator.nextPageLabel');
    previousPageLabel = this.translateService.translate('paginator.previousPageLabel');

    getRangeLabel(page: number, pageSize: number, length: number): string {
        const amountPages = length ? Math.ceil(length / pageSize) : 1;
        return this.translateService.translate('paginator.rangeLabel', { page: page + 1, amountPages });
    }
}
