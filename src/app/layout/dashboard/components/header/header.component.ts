import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PushPipe } from '@rx-angular/template/push';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslocoModule } from '@ngneat/transloco';

import { SETTINGS_RX_STATE } from '@core/stores';
import { addFASvgIcons } from '@core/utils';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterModule, MatButtonModule, MatIconModule, PushPipe, TranslocoModule],
    standalone: true
})
export class HeaderComponent {
    private breakpointObserver = inject(BreakpointObserver);
    settingsState = inject(SETTINGS_RX_STATE);
    isCompact$: Observable<boolean> = this.breakpointObserver
        .observe(['(min-width: 960px)', '(max-width: 959.98px)'])
        .pipe(map(({ breakpoints: { '(max-width: 959.98px)': isCompact } }) => isCompact));

    toggleSidebar() {
        this.settingsState.set('sidebarMode', ({ sidebarMode }) => (sidebarMode === 'compact' ? 'full' : 'compact'));
    }

    constructor() {
        addFASvgIcons(['bars'], 'far');
    }
}
