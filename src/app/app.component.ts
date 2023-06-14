import { ChangeDetectionStrategy, Component, inject, Inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouteConfigLoadEnd, RouteConfigLoadStart, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services';
import { FETCH_INTERCEPTOR } from '@core/tokens';
import { concatStringStream } from '@core/utils';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import { RxIf } from '@rx-angular/template/if';
import { Observable, startWith } from 'rxjs';
import { distinctUntilChanged, filter, first, map, merge } from 'rxjs';

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

    constructor(@Inject(FETCH_INTERCEPTOR) interceptor: FetchInterceptor) {
        interceptor.on('response', async response => {
            if (response.status === 403 && response.body) {
                const result = await concatStringStream(response.body);
                if (result.includes('Failed to authenticate request')) {
                    this.authService.signOut();
                }
            }
        });
    }
}
