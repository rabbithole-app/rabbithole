import { provideHttpClient } from '@angular/common/http';
import { APP_INITIALIZER, enableProdMode, importProvidersFrom } from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TranslocoService, TRANSLOCO_LOADING_TEMPLATE } from '@ngneat/transloco';
import { TranslocoLocaleModule } from '@ngneat/transloco-locale';
import { RxState } from '@rx-angular/state';
import { firstValueFrom } from 'rxjs';

import { SettingsState, SETTINGS_RX_STATE } from '@core/stores';
import { LocalStorageService, NotificationService, ProfileService, WINDOW_PROVIDERS } from '@core/services';
import { TranslocoRootModule } from './app/transloco-root.module';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/routes';
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

function preloadLanguage(settingsState: RxState<SettingsState>, transloco: TranslocoService) {
    return () => {
        const lang = settingsState.get('language');
        transloco.setActiveLang(lang);
        return firstValueFrom(transloco.load(lang));
    };
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(
            BrowserAnimationsModule,
            MatSnackBarModule,
            TranslocoRootModule,
            TranslocoLocaleModule.forRoot({
                langToLocaleMapping: {
                    en: 'en-US',
                    ru: 'ru-RU'
                }
            })
        ),
        provideRouter(appRoutes, withPreloading(PreloadAllModules)),
        provideHttpClient(/*withInterceptors([])*/),
        { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'fill' } },
        ProfileService,
        LocalStorageService,
        NotificationService,
        WINDOW_PROVIDERS,
        {
            provide: APP_INITIALIZER,
            multi: true,
            useFactory: preloadLanguage,
            deps: [SETTINGS_RX_STATE, TranslocoService]
        },
        {
            provide: TRANSLOCO_LOADING_TEMPLATE,
            useValue: '<p>loading...</p>'
        }
    ]
}).catch(err => console.error(err));
