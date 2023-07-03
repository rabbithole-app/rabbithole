import { HttpClient } from '@angular/common/http';
import { Injectable, NgModule, isDevMode } from '@angular/core';
import { TRANSLOCO_CONFIG, TRANSLOCO_LOADER, Translation, TranslocoLoader, TranslocoModule, translocoConfig } from '@ngneat/transloco';
import { TranslocoLocaleModule } from '@ngneat/transloco-locale';
import { TranslocoMessageFormatModule } from '@ngneat/transloco-messageformat';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
    constructor(private http: HttpClient) {}

    getTranslation(lang: string) {
        return this.http.get<Translation>(`../assets/i18n/${lang}.json`);
    }
}

@NgModule({
    imports: [
        TranslocoLocaleModule.forRoot({
            langToLocaleMapping: {
                en: 'en-US',
                ru: 'ru-RU'
            }
        }),
        TranslocoMessageFormatModule.forRoot()
    ],
    exports: [TranslocoModule],
    providers: [
        {
            provide: TRANSLOCO_CONFIG,
            useValue: translocoConfig({
                availableLangs: ['en', 'ru'],
                defaultLang: 'en',
                reRenderOnLangChange: true,
                prodMode: !isDevMode()
            })
        },
        { provide: TRANSLOCO_LOADER, useClass: TranslocoHttpLoader }
    ]
})
export class TranslocoRootModule {}
