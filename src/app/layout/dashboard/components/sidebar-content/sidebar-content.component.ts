import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgForOf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLinkWithHref, RouterLinkActive } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { IfModule } from '@rx-angular/template/if';
import { PushModule } from '@rx-angular/template/push';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { trigger } from '@angular/animations';
import { shareReplay, tap } from 'rxjs';

import { SETTINGS_RX_STATE } from '@core/stores';
import { addFASvgIcons } from '@core/utils';
import { SIDEBAR_TEXT_ANIMATION } from '@core/animations';
import { SidebarService } from '../../services/sidebar.service';
import { UploadService } from '@features/upload/services';

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
        PushModule,
        IfModule,
        MatButtonModule,
        MatMenuModule
    ],
    templateUrl: './sidebar-content.component.html',
    styleUrls: ['./sidebar-content.component.scss'],
    animations: [trigger('textAnimation', SIDEBAR_TEXT_ANIMATION)],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarContentComponent {
    readonly navigation = [
        { link: 'drive', label: 'navigation.my-files', icon: 'far:house', activeIcon: 'fas:house' },
        { link: 'canisters', label: 'navigation.canisters', icon: 'far:database', activeIcon: 'fas:database' },
        { link: 'shared', label: 'navigation.shared', icon: 'far:share', activeIcon: 'fas:share', disabled: true },
        { link: 'favorites', label: 'navigation.favorites', icon: 'far:star', activeIcon: 'fas:star', disabled: true },
        { link: 'trash', label: 'navigation.trash', icon: 'far:trash-can', activeIcon: 'fas:trash-can', disabled: true }
    ];
    settingsState = inject(SETTINGS_RX_STATE);
    sidebarService = inject(SidebarService);
    uploadService = inject(UploadService);
    isFull$ = this.sidebarService.select('isFull').pipe(shareReplay(1));

    constructor() {
        const icons = ['house', 'database', 'atom', 'share', 'star', 'trash-can'];
        addFASvgIcons([...icons, 'cloud-arrow-up', 'files', 'folder-plus', 'arrow-right-from-bracket'], 'far');
        addFASvgIcons(icons, 'fas');
    }

    browseDirectory() {
        console.log('browse directory');
    }

    handleFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        const files: FileList = input.files as FileList;
        this.uploadService.add(files);
    }
}
