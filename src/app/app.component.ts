import { ApplicationRef, ChangeDetectionStrategy, Component, inject, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouteConfigLoadEnd, RouteConfigLoadStart, Router, RouterModule } from '@angular/router';
import { SwUpdate, VersionEvent, VersionReadyEvent } from '@angular/service-worker';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import { RxIf } from '@rx-angular/template/if';
import { WINDOW } from 'ngx-window-token';
import { interval, merge, Observable } from 'rxjs';
import { distinctUntilChanged, exhaustMap, filter, first, map, startWith, switchMap } from 'rxjs/operators';

import { UpdateApplicationDialogComponent } from '@core/components/update-application-dialog/update-application-dialog.component';
import { AuthService } from '@core/services';
import { FETCH_INTERCEPTOR } from '@core/tokens';
import { concatStringStream } from '@core/utils';

@Component({
    selector: 'app-root',
    template: `
        <mat-spinner [diameter]="48" *rxIf="loading$"></mat-spinner>
        <router-outlet></router-outlet>
    `,
    styles: [
        `
            :host {
                display: flex;
                justify-content: center;
                min-height: 100%;
                background-color: var(--body-bg);
            }

            .mat-mdc-progress-spinner {
                align-self: center;
            }
        `
    ],
    standalone: true,
    imports: [RouterModule, RxIf, MatProgressSpinnerModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
    private authService = inject(AuthService);
    private router = inject(Router);
    #appRef = inject(ApplicationRef);
    loading$: Observable<boolean> = merge(
        this.router.events.pipe(
            filter(event => event instanceof RouteConfigLoadStart),
            first(),
            map(() => true)
        ),
        this.router.events.pipe(
            filter(event => event instanceof RouteConfigLoadEnd),
            first(),
            map(() => false)
        )
    ).pipe(distinctUntilChanged(), startWith(true));
    readonly #swUpdate = inject(SwUpdate);
    readonly #dialog = inject(MatDialog);
    readonly window = inject(WINDOW);

    constructor(@Inject(FETCH_INTERCEPTOR) interceptor: FetchInterceptor) {
        interceptor.on('response', async ({ response }) => {
            if (response.status === 403 && response.body) {
                const result = await concatStringStream(response.body);
                if (result.includes('Failed to authenticate request')) {
                    this.authService.signOut();
                }
            }
        });

        if (this.#swUpdate.isEnabled) {
            this.#swUpdate.versionUpdates
                .pipe(
                    filter((event: VersionEvent): event is VersionReadyEvent => event.type === 'VERSION_READY'),
                    takeUntilDestroyed()
                )
                .subscribe(({ currentVersion, latestVersion }: VersionReadyEvent) => {
                    console.info({ currentVersion, latestVersion });
                    this.#updateDialog();
                });
            this.#appRef.isStable
                .pipe(
                    first(stable => stable),
                    switchMap(() => interval(20000)),
                    exhaustMap(() => this.#swUpdate.checkForUpdate()),
                    takeUntilDestroyed()
                )
                .subscribe();
        }
    }

    #updateDialog() {
        const dialogRef = this.#dialog.open(UpdateApplicationDialogComponent, {
            width: '450px'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.window?.location.reload();
            }
        });
    }
}
