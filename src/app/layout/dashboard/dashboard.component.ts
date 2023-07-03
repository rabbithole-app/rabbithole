import { ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { ResolveEnd, ResolveStart, Router, RouterModule, RouterOutlet } from '@angular/router';
import { RxIf } from '@rx-angular/template/if';
import { has } from 'lodash';
import { filter, map, merge } from 'rxjs';

import { routeAnimations } from '@core/animations';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { SidebarService } from './services/sidebar.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [MatProgressBarModule, RouterModule, SidebarComponent, HeaderComponent, FooterComponent, MatSidenavModule, RxIf],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [routeAnimations]
})
export class DashboardComponent {
    private outlet = inject(RouterOutlet);
    private sidebarService = inject(SidebarService);
    private router = inject(Router);
    @ViewChild(MatDrawer) set drawer(value: MatDrawer) {
        this.sidebarService.setDrawer(value);
    }
    loading$ = merge(
        this.router.events.pipe(
            filter(event => event instanceof ResolveStart),
            map(() => true)
        ),
        this.router.events.pipe(
            filter(event => event instanceof ResolveEnd),
            map(() => false)
        )
    );

    get hasRouteAnimations() {
        return this.outlet.isActivated && has(this.outlet.activatedRouteData, 'title');
    }
}
