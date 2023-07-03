import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { isNull } from 'lodash';
import { WINDOW } from 'ngx-window-token';
import { filter, firstValueFrom, from, repeat, switchMap, takeUntil, throwError } from 'rxjs';
import { catchError, delayWhen, map, skip, tap, withLatestFrom } from 'rxjs/operators';

import { ClosableSnackbarComponent } from '@core/components/closable-snackbar/closable-snackbar.component';
import { AUTH_MAX_TIME_TO_LIVE, AUTH_POPUP_HEIGHT, AUTH_POPUP_WIDTH } from '@core/constants';
import { environment } from 'environments/environment';
import { AUTH_RX_STATE, AuthStatus } from '../stores';

interface State {
    signedOutSnackBarRef: MatSnackBarRef<ClosableSnackbarComponent>;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);
    private router = inject(Router);
    private window = inject<Window>(WINDOW);
    private translocoService = inject(TranslocoService);
    private snackBar = inject(MatSnackBar);

    anonymous$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Anonymous));
    initialized$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Initialized));

    constructor() {
        super();
        const worker = this.authState.get('worker');

        if (worker) {
            worker.onmessage = async ({ data }) => {
                if (data === 'rabbitholeSignOutAuthTimer') {
                    await this.signOut();
                    const signedOutSnackBarRef = this.snackBar.openFromComponent(ClosableSnackbarComponent, {
                        data: this.translocoService.translate('application.signed-out')
                    });
                    this.set({ signedOutSnackBarRef });
                }
            };
            this.authState
                .select('status')
                .pipe(
                    map(status => (status === AuthStatus.Initialized ? 'startAuthTimer' : 'stopAuthTimer')),
                    delayWhen(() => this.authState.select('isAuthenticated').pipe(skip(1))),
                    withLatestFrom(this.authState.select('worker'))
                )
                .subscribe(([action, worker]) => {
                    worker.postMessage({ action });
                });
            this.select('signedOutSnackBarRef')
                .pipe(
                    delayWhen(() => this.authState.select('isAuthenticated').pipe(filter(v => v))),
                    takeUntil(this.anonymous$),
                    repeat({ delay: () => this.initialized$ })
                )
                .subscribe(snackBarRef => snackBarRef.dismiss());
        }
    }

    signIn() {
        return firstValueFrom(
            this.authState.select('client').pipe(
                switchMap(client =>
                    from(
                        client.login({
                            maxTimeToLive: AUTH_MAX_TIME_TO_LIVE,
                            identityProvider: environment.identityUrl,
                            onSuccess: () => this.authState.set({ status: AuthStatus.Initialized }),
                            onError: e => throwError(() => new Error(e)),
                            windowOpenerFeatures: this.popupCenter({ width: AUTH_POPUP_WIDTH, height: AUTH_POPUP_HEIGHT })
                        })
                    )
                ),
                catchError(throwError)
            )
        );
    }

    signOut() {
        return firstValueFrom(
            this.authState.select('client').pipe(
                switchMap(client => from(client.logout())),
                tap(() => this.authState.set({ status: AuthStatus.Anonymous })),
                delayWhen(() => this.authState.select('isAuthenticated').pipe(filter(v => !v))),
                tap(() => {
                    const url = this.router.url;
                    const redirect = url === '/' || url.startsWith('/login') ? undefined : url;
                    this.router.navigate(['/login'], { queryParamsHandling: 'merge', queryParams: { redirect } });
                })
            )
        );
    }

    private popupCenter({ width, height }: { width: number; height: number }): string | undefined {
        if (isNull(this.window) || isNull(this.window.top)) {
            return undefined;
        }

        const {
            top: { innerWidth, innerHeight }
        } = this.window;

        const y = innerHeight / 2 + screenY - height / 2;
        const x = innerWidth / 2 + screenX - width / 2;

        return `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${y}, left=${x}`;
    }
}
