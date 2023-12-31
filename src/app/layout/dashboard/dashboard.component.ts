import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewChild, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { NavigationCancel, ResolveEnd, ResolveStart, Router, RouterModule, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { has } from 'lodash';
import { WINDOW } from 'ngx-window-token';
import { fromEvent, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';

import { routeAnimations } from '@core/animations';
import { EmptyComponent } from '@core/components/empty/empty.component';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { SidebarService } from './services/sidebar.service';
import { DisclaimerDialogComponent } from '@core/components/disclaimer-dialog/disclaimer-dialog.component';
import { SETTINGS_RX_STATE } from '@core/stores';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        MatProgressBarModule,
        RouterModule,
        SidebarComponent,
        HeaderComponent,
        FooterComponent,
        MatSidenavModule,
        RxIf,
        EmptyComponent,
        MatButtonModule,
        NgClass,
        TranslocoModule
    ],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [routeAnimations]
})
export class DashboardComponent implements OnInit {
    private outlet = inject(RouterOutlet);
    private sidebarService = inject(SidebarService);
    private router = inject(Router);
    readonly #dialog = inject(MatDialog);
    settingsState = inject(SETTINGS_RX_STATE);

    @ViewChild(MatDrawer) set drawer(value: MatDrawer) {
        this.sidebarService.setDrawer(value);
    }
    loading$ = merge(
        this.router.events.pipe(
            filter(event => event instanceof ResolveStart),
            map(() => true)
        ),
        this.router.events.pipe(filter(event => event instanceof ResolveEnd)).pipe(map(() => false)),
        this.router.events.pipe(filter(event => event instanceof NavigationCancel)).pipe(map(() => false))
    );
    online: WritableSignal<boolean> = signal(true);
    #window = inject(WINDOW);

    get hasRouteAnimations() {
        return this.outlet.isActivated && has(this.outlet.activatedRouteData, 'title');
    }

    constructor() {
        if (this.#window) {
            merge(
                fromEvent(this.#window, 'offline', { passive: true }).pipe(map(() => false)),
                fromEvent(this.#window, 'online', { passive: true }).pipe(map(() => true))
            )
                .pipe(takeUntilDestroyed())
                .subscribe(online => this.online.set(online));
        }
    }

    ngOnInit(): void {
        if (this.settingsState.get('showDisclaimer')) {
            this.#disclaimerDialog();
        }
    }

    #disclaimerDialog() {
        const dialogRef = this.#dialog.open<DisclaimerDialogComponent, unknown, boolean>(DisclaimerDialogComponent, {
            width: '450px'
        });

        dialogRef.afterClosed().subscribe(result => {
            this.settingsState.set({ showDisclaimer: !result });
        });
    }
}
