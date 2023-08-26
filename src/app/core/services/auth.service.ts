import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { isNull } from 'lodash';
import { WINDOW } from 'ngx-window-token';
import { firstValueFrom, from, merge, Observable, Subject, throwError } from 'rxjs';
import { catchError, delayWhen, filter, map, repeat, skip, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs/operators';

import { ClosableSnackbarComponent } from '@core/components/closable-snackbar/closable-snackbar.component';
import { APP_DERIVATION_ORIGIN, AUTH_MAX_TIME_TO_LIVE, AUTH_POPUP_HEIGHT, AUTH_POPUP_WIDTH } from '@core/constants';
import { AUTH_CLIENT_INIT_STATE } from '@core/tokens';
import { environment } from 'environments/environment';
import { AUTH_RX_STATE, AuthStatus } from '../stores';
import { CoreService } from './core.service';
import { isCustomDomain } from '@core/utils';

interface State {
    signedOutSnackBarRef: MatSnackBarRef<ClosableSnackbarComponent>;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService extends RxState<State> {
    private authState = inject(AUTH_RX_STATE);
    #authClientInitState = inject(AUTH_CLIENT_INIT_STATE);
    #coreService = inject(CoreService);
    private router = inject(Router);
    private window = inject<Window>(WINDOW);
    private translocoService = inject(TranslocoService);
    private snackBar = inject(MatSnackBar);
    #workerMessage: Subject<MessageEvent> = new Subject();
    workerMessage$: Observable<MessageEvent> = this.#workerMessage.asObservable();
    anonymous$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Anonymous));
    initialized$ = this.authState.select('status').pipe(filter(status => status === AuthStatus.Initialized));

    constructor() {
        super();
        const worker = this.authState.get('worker');
        this.authState.set(this.#authClientInitState);

        if (worker) {
            worker.onmessage = event => this.#workerMessage.next(event);
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
            merge(this.#coreService.workerMessage$, this.workerMessage$)
                .pipe(
                    filter(({ data }) => data.action === 'rabbitholeSignOutAuthTimer'),
                    takeUntilDestroyed()
                )
                .subscribe(async () => {
                    await this.signOut();
                    const signedOutSnackBarRef = this.snackBar.openFromComponent(ClosableSnackbarComponent, {
                        data: this.translocoService.translate('application.signed-out')
                    });
                    this.set({ signedOutSnackBarRef });
                });
        }
    }

    signIn() {
        return firstValueFrom(
            this.authState.select('client').pipe(
                switchMap(client =>
                    from(
                        client.login({
                            maxTimeToLive: AUTH_MAX_TIME_TO_LIVE,
                            ...(isCustomDomain() && {
                                derivationOrigin: APP_DERIVATION_ORIGIN
                            }),
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
