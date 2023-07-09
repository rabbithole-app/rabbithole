import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, Signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { SETTINGS_RX_STATE } from '@core/stores';
import { addFASvgIcons } from '@core/utils';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterModule, MatButtonModule, MatIconModule, TranslocoModule],
    standalone: true
})
export class HeaderComponent {
    private breakpointObserver = inject(BreakpointObserver);
    settingsState = inject(SETTINGS_RX_STATE);
    isCompact$: Observable<boolean> = this.breakpointObserver
        .observe(['(min-width: 960px)', '(max-width: 959.98px)'])
        .pipe(map(({ breakpoints: { '(max-width: 959.98px)': isCompact } }) => isCompact));
    isCompact: Signal<boolean> = toSignal(this.isCompact$, { initialValue: false });

    toggleSidebar() {
        this.settingsState.set('sidebarMode', ({ sidebarMode }) => (sidebarMode === 'compact' ? 'full' : 'compact'));
    }

    constructor() {
        addFASvgIcons(['bars'], 'far');
    }
}
