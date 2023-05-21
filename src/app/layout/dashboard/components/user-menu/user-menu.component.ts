import { ChangeDetectionStrategy, Component, ViewChild, ViewContainerRef, inject } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenu, MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { RouterLinkWithHref } from '@angular/router';
import { RxIf } from '@rx-angular/template/if';
import { TranslocoModule } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { filter, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isUndefined } from 'lodash';

import { AvatarComponent } from '../avatar/avatar.component';
import { AuthService, ProfileService } from '@core/services';
import { WalletComponent } from '@features/wallet/wallet.component';
import { addFASvgIcons } from '@core/utils';
import { CustomOverlayRef } from '@core/components/overlay';
import { UploadTriggerComponent } from '@features/upload/components/upload-trigger/upload-trigger.component';
import { SETTINGS_RX_STATE } from '@core/stores';

interface State {
    openedMenu?: CustomOverlayRef;
    trigger: MatMenuTrigger;
}

@Component({
    selector: 'app-user-menu',
    standalone: true,
    imports: [
        RouterLinkWithHref,
        MatDividerModule,
        MatMenuModule,
        AvatarComponent,
        MatIconModule,
        TranslocoModule,
        WalletComponent,
        UploadTriggerComponent,
        RxIf
    ],
    providers: [RxState],
    templateUrl: './user-menu.component.html',
    styleUrls: ['./user-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserMenuComponent extends RxState<State> {
    @ViewChild('wallet', { read: ViewContainerRef }) walletContainer!: ViewContainerRef;
    @ViewChild('menu', { read: MatMenu }) menu!: MatMenu;
    @ViewChild('trigger', { read: MatMenuTrigger }) set trigger(value: MatMenuTrigger) {
        this.set({ trigger: value });
    }
    get trigger(): MatMenuTrigger {
        return this.get('trigger');
    }
    authService = inject(AuthService);
    private settingsState = inject(SETTINGS_RX_STATE);
    expertMode$ = this.settingsState.select('expertMode');
    private profileService = inject(ProfileService);
    canInvite$ = this.profileService.select('canInvite');

    constructor() {
        super();
        addFASvgIcons(['user', 'gear', 'arrow-right-from-bracket', 'envelope', 'database'], 'far');
        this.connect(
            this.select('openedMenu').pipe(
                filter(ref => !isUndefined(ref)),
                switchMap(menuRef => (menuRef as NonNullable<typeof menuRef>).afterClosed$),
                map(() => ({
                    openedMenu: undefined
                }))
            )
        );
        this.select('trigger').pipe(switchMap(trigger => trigger.menuOpened.asObservable()), takeUntilDestroyed()).subscribe(() => {
            this.walletContainer.clear();
            this.walletContainer.createComponent(WalletComponent);
        })
    }
}
