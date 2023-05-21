import { NgSwitch, NgSwitchCase } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { AsyncSubject, filter, Observable, switchMap, takeUntil } from 'rxjs';
import { entries, get, has, pick } from 'lodash';

import { AUTH_RX_STATE, AuthStatus } from '@core/stores';
import { AuthService } from '@core/services';
import { TranslocoModule } from '@ngneat/transloco';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { LogoComponent } from '../dashboard/components/logo/logo.component';
import { PushPipe } from '@rx-angular/template/push';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [NgSwitch, NgSwitchCase, PushPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoModule, LogoComponent],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
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
