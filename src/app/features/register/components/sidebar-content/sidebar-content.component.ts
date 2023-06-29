import { RxPush } from '@rx-angular/template/push';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgForOf } from '@angular/common';
import { RouterLinkActive, RouterLinkWithHref } from '@angular/router';
import { trigger } from '@angular/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@ngneat/transloco';
import { RxIf } from '@rx-angular/template/if';
import { shareReplay } from 'rxjs';

import { SETTINGS_RX_STATE } from '@core/stores';
import { SidebarService } from 'app/layout/dashboard/services/sidebar.service';
import { SIDEBAR_TEXT_ANIMATION } from '@core/animations';

@Component({
    selector: 'app-sidebar-content',
    standalone: true,
    imports: [NgForOf, TranslocoModule, RouterLinkWithHref, RouterLinkActive, MatTooltipModule, RxPush, MatIconModule, RxIf, MatButtonModule],
    templateUrl: './sidebar-content.component.html',
    styleUrls: ['../../../../layout/dashboard/components/sidebar-content/sidebar-content.component.scss'],
    animations: [trigger('textAnimation', SIDEBAR_TEXT_ANIMATION)],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarContentComponent {
    readonly navigation = [
        { link: '/', label: 'navigation.register', icon: 'far:user-plus', activeIcon: 'fas:user-plus', disabled: false },
        { link: 'invite', label: 'navigation.canisters', icon: 'far:paper-plane-top', activeIcon: 'fas:paper-plane-top', disabled: false }
    ];
    settingsState = inject(SETTINGS_RX_STATE);
    sidebarService = inject(SidebarService);
    isFull$ = this.sidebarService.select('isFull').pipe(shareReplay(1));

    constructor() {
        // addFASvgIcons(['twitter'], 'fab');
    }
}
