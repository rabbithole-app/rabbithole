import { trigger } from '@angular/animations';
import { NgForOf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLinkActive, RouterLinkWithHref } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { SIDEBAR_TEXT_ANIMATION } from '@core/animations';
import { SETTINGS_RX_STATE } from '@core/stores';
import { addFASvgIcons } from '@core/utils';
import { UploadService } from '@features/upload/services';
import { SidebarService } from '../../services/sidebar.service';

type NavigationItem = {
    path: string;
    label: string;
    icon: string;
    activeIcon: string;
    disabled?: boolean;
    visibleInExpertMode?: boolean;
};

@Component({
    selector: 'app-sidebar-content',
    standalone: true,
    imports: [
        NgForOf,
        RouterLinkWithHref,
        RouterLinkActive,
        MatTooltipModule,
        TranslocoModule,
        MatIconModule,
        RxPush,
        RxIf,
        MatButtonModule,
        MatMenuModule,
        RxFor
    ],
    templateUrl: './sidebar-content.component.html',
    styleUrls: ['./sidebar-content.component.scss'],
    animations: [trigger('textAnimation', SIDEBAR_TEXT_ANIMATION)],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarContentComponent {
    readonly navigation: NavigationItem[] = [
        { path: '/drive', label: 'navigation.my-files', icon: 'far:house', activeIcon: 'fas:house' },
        { path: '/canisters', label: 'navigation.canisters', icon: 'far:database', activeIcon: 'fas:database', visibleInExpertMode: true },
        { path: '/shared', label: 'navigation.shared', icon: 'far:share', activeIcon: 'fas:share' },
        { path: '/favorites', label: 'navigation.favorites', icon: 'far:star', activeIcon: 'fas:star', disabled: true },
        { path: '/trash', label: 'navigation.trash', icon: 'far:trash-can', activeIcon: 'fas:trash-can', disabled: true }
    ];
    settingsState = inject(SETTINGS_RX_STATE);
    navigation$: Observable<NavigationItem[]> = this.settingsState
        .select('expertMode')
        .pipe(map(expertMode => (expertMode ? this.navigation : this.navigation.filter(({ visibleInExpertMode }) => !visibleInExpertMode))));
    sidebarService = inject(SidebarService);
    uploadService = inject(UploadService);
    isFull$ = this.sidebarService.select('isFull').pipe(shareReplay(1));

    constructor() {
        const icons = ['house', 'database', 'atom', 'share', 'star', 'trash-can'];
        addFASvgIcons([...icons, 'cloud-arrow-up', 'files', 'folder-plus', 'arrow-right-from-bracket'], 'far');
        addFASvgIcons(icons, 'fas');
    }

    trackNavItem(index: number, item: NavigationItem) {
        return item.path;
    }
}
