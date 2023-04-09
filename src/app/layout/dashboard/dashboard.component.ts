import { ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { has } from 'lodash';

import { routeAnimations } from '@core/animations';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { SidebarService } from './services/sidebar.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent, FooterComponent, MatSidenavModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [routeAnimations]
})
export class DashboardComponent {
    private outlet = inject(RouterOutlet);
    private sidebarService = inject(SidebarService);
    @ViewChild(MatDrawer) set drawer(value: MatDrawer) {
        this.sidebarService.setDrawer(value);
    }

    get hasRouteAnimations() {
        return this.outlet.isActivated && has(this.outlet.activatedRouteData, 'title');
    }
}
