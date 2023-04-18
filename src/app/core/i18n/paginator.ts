import { inject, Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@ngneat/transloco';
import { Subject } from 'rxjs';

@Injectable()
export class RabbitholePaginatorIntl implements MatPaginatorIntl {
    translocoService = inject(TranslocoService);
    changes = new Subject<void>();
    firstPageLabel = this.translocoService.translate('paginator.firstPageLabel');
    itemsPerPageLabel = this.translocoService.translate('paginator.itemsPerPageLabel');
    lastPageLabel = this.translocoService.translate('paginator.lastPageLabel');
    nextPageLabel = this.translocoService.translate('paginator.nextPageLabel');
    previousPageLabel = this.translocoService.translate('paginator.previousPageLabel');

    getRangeLabel(page: number, pageSize: number, length: number): string {
        const amountPages = length ? Math.ceil(length / pageSize) : 1;
        return this.translocoService.translate('paginator.rangeLabel', { page: page + 1, amountPages });
    }
}
