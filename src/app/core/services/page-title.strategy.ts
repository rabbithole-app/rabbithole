import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';

@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
    #translocoService = inject(TranslocoService);
    constructor(private readonly title: Title) {
        super();
    }

    override updateTitle(routerState: RouterStateSnapshot) {
        const title = this.buildTitle(routerState);

        if (title !== undefined) {
            this.title.setTitle(`${this.#translocoService.translate('application.title')} - ${this.#translocoService.translate(title)}`);
        }
    }
}
