import { ChangeDetectionStrategy, Component, Signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs/operators';
import { RxIf } from '@rx-angular/template/if';
import { entries, get, has, pick } from 'lodash';

import { AuthService, ClientService } from '@core/services';
import { AUTH_RX_STATE } from '@core/stores';
import { LogoComponent } from '../dashboard/components/logo/logo.component';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [RxIf, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoModule, LogoComponent],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    authService = inject(AuthService);
    readonly #authState = inject(AUTH_RX_STATE);
    readonly #route = inject(ActivatedRoute);
    readonly #router = inject(Router);
    readonly #matIconRegistry = inject(MatIconRegistry);
    readonly #domSanitizer = inject(DomSanitizer);
    readonly #clientService = inject(ClientService);
    initialized: Signal<boolean> = toSignal(this.#authState.select('isAuthenticated'), { initialValue: this.#clientService.isAuthenticated() });

    constructor() {
        entries({
            dfinity: '../../../assets/dfn.svg',
            fullyOnChain: '../../../assets/fully_on_chain-stripe-dark_text.svg'
        }).forEach(([iconName, url]) => {
            this.#matIconRegistry.addSvgIconInNamespace('ic', iconName, this.#domSanitizer.bypassSecurityTrustResourceUrl(url));
        });

        this.#authState
            .select('isAuthenticated')
            .pipe(
                filter(isAuth => isAuth),
                switchMap(() => this.#route.queryParams),
                takeUntilDestroyed()
            )
            .subscribe(queryParams => {
                const url = has(queryParams, 'redirect') ? get(queryParams, 'redirect') : '/drive';
                this.#router.navigate([url], { queryParams: pick(queryParams, ['internetIdentityUrl', 'canisterId']) });
            });
    }
}
