import { ChangeDetectionStrategy, Component, ViewChild, ViewContainerRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { RouterLinkWithHref } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { RxIf } from '@rx-angular/template/if';
import { isUndefined } from 'lodash';
import { filter, map, switchMap } from 'rxjs';

import { CustomOverlayRef } from '@core/components/overlay';
import { AuthService, ProfileService } from '@core/services';
import { SETTINGS_RX_STATE } from '@core/stores';
import { addFASvgIcons } from '@core/utils';
import { UploadTriggerComponent } from '@features/upload/components/upload-trigger/upload-trigger.component';
import { WalletComponent } from '@features/wallet/wallet.component';
import { AvatarComponent } from '../avatar/avatar.component';

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
        this.select('trigger')
            .pipe(
                switchMap(trigger => trigger.menuOpened.asObservable()),
                takeUntilDestroyed()
            )
            .subscribe(() => {
                this.walletContainer.clear();
                this.walletContainer.createComponent(WalletComponent);
            });
    }
}
