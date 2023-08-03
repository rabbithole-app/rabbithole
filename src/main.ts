import { provideHttpClient, withFetch } from '@angular/common/http';
import { APP_INITIALIZER, enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NoPreloading, TitleStrategy, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { AuthClient } from '@dfinity/auth-client';
import { TRANSLOCO_LOADING_TEMPLATE, TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { firstValueFrom, forkJoin } from 'rxjs';

import { CoreService, LocalStorageService, NotificationService, PageTitleStrategy, ProfileService } from '@core/services';
import { SETTINGS_RX_STATE, SettingsState } from '@core/stores';
import { AUTH_CLIENT_INIT_STATE } from '@core/tokens';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/routes';
import { TranslocoRootModule } from './app/transloco-root.module';
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

function initAuthClientAndPreloadLanguage(settingsState: RxState<SettingsState>, transloco: TranslocoService, coreService: CoreService) {
    return () => {
        const lang = settingsState.get('language');
        transloco.setActiveLang(lang);
        return firstValueFrom(forkJoin([coreService.createAuthClient(), transloco.load(lang)]));
    };
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserAnimationsModule, MatSnackBarModule, TranslocoRootModule, MatDialogModule),
        provideRouter(appRoutes, withPreloading(NoPreloading), withComponentInputBinding()),
        provideHttpClient(withFetch() /*withInterceptors([])*/),
        { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'fill' } },
        ProfileService,
        LocalStorageService,
        NotificationService,
        {
            provide: APP_INITIALIZER,
            multi: true,
            useFactory: initAuthClientAndPreloadLanguage,
            deps: [SETTINGS_RX_STATE, TranslocoService, CoreService]
        },
        {
            provide: TRANSLOCO_LOADING_TEMPLATE,
            useValue: '<p>loading...</p>'
        },
        {
            provide: AUTH_CLIENT_INIT_STATE,
            useFactory: (coreService: CoreService) => {
                const client = coreService.client() as AuthClient;
                const isAuthenticated = coreService.isAuthenticated();
                return { client, isAuthenticated };
            },
            deps: [CoreService]
        },
        { provide: TitleStrategy, useClass: PageTitleStrategy },
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
        })
    ]
}).catch(err => console.error(err));
