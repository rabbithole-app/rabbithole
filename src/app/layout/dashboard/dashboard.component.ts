import { ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';
import { ResolveEnd, ResolveStart, Router, RouterModule, RouterOutlet } from '@angular/router';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { filter, map, merge } from 'rxjs';
import { IfModule } from '@rx-angular/template/if';
import { has } from 'lodash';

import { routeAnimations } from '@core/animations';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { SidebarService } from './services/sidebar.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [MatProgressBarModule, RouterModule, SidebarComponent, HeaderComponent, FooterComponent, MatSidenavModule, IfModule],
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
