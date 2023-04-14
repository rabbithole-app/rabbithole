import { AfterViewInit, ChangeDetectionStrategy, Component, ViewChild, ViewContainerRef, inject } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenu, MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { AsyncSubject, filter, map, switchMap, takeUntil } from 'rxjs';
import { isUndefined } from 'lodash';

import { AvatarComponent } from '../avatar/avatar.component';
import { AuthService } from '@core/services';
import { WalletComponent } from '@features/wallet/wallet.component';
import { addFASvgIcons } from '@core/utils';
import { CustomOverlayRef } from '@core/components/overlay';
import { UploadTriggerComponent } from '@features/upload/components/upload-trigger/upload-trigger.component';
import { RouterLinkWithHref } from '@angular/router';

interface State {
    openedMenu?: CustomOverlayRef;
}

@Component({
    selector: 'app-user-menu',
    standalone: true,
    imports: [RouterLinkWithHref, MatDividerModule, MatMenuModule, AvatarComponent, MatIconModule, TranslocoModule, WalletComponent, UploadTriggerComponent],
    providers: [RxState],
    templateUrl: './user-menu.component.html',
    styleUrls: ['./user-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserMenuComponent extends RxState<State> implements AfterViewInit {
    @ViewChild('wallet', { read: ViewContainerRef }) walletContainer!: ViewContainerRef;
    @ViewChild('menu', { read: MatMenu }) menu!: MatMenu;
    @ViewChild('trigger', { read: MatMenuTrigger }) trigger!: MatMenuTrigger;
    authService = inject(AuthService);
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();

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
    }

    ngAfterViewInit(): void {
        this.trigger.menuOpened
            .asObservable()
            .pipe(takeUntil(this.destroyed))
            .subscribe(() => {
                this.walletContainer.clear();
                this.walletContainer.createComponent(WalletComponent);
            });
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy();
        this.destroyed.next();
        this.destroyed.complete();
    }
}
