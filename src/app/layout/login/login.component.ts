import { NgSwitch, NgSwitchCase } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { RxPush } from '@rx-angular/template/push';
import { entries, get, has, pick } from 'lodash';
import { AsyncSubject, Observable } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/services';
import { AUTH_RX_STATE, AuthStatus } from '@core/stores';
import { LogoComponent } from '../dashboard/components/logo/logo.component';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [NgSwitch, NgSwitchCase, RxPush, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoModule, LogoComponent],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
    authService = inject(AuthService);
    private authState = inject(AUTH_RX_STATE);
    status$: Observable<AuthStatus> = this.authState.select('status');
    readonly authStatus = AuthStatus;
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    constructor(private matIconRegistry: MatIconRegistry, private domSanitizer: DomSanitizer) {
        entries({
            dfinity: '../../../assets/dfn.svg',
            fullyOnChain: '../../../assets/fully_on_chain-stripe-dark_text.svg'
        }).forEach(([iconName, url]) => {
            matIconRegistry.addSvgIconInNamespace('ic', iconName, domSanitizer.bypassSecurityTrustResourceUrl(url));
        });
    }

    ngOnInit(): void {
        this.authState
            .select('isAuthenticated')
            .pipe(
                filter(isAuth => isAuth),
                switchMap(() => this.route.queryParams),
                takeUntil(this.destroyed)
            )
            .subscribe(queryParams => {
                const url = has(queryParams, 'redirect') ? get(queryParams, 'redirect') : '/drive';
                this.router.navigate([url], { queryParams: pick(queryParams, ['internetIdentityUrl', 'canisterId']) });
            });
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }
}
