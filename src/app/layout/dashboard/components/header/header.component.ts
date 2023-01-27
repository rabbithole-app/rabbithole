import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Observable } from 'rxjs';
import { filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { PushModule } from '@rx-angular/template/push';
import { TranslocoModule } from '@ngneat/transloco';

import { SETTINGS_RX_STATE } from '@core/stores';
import { AuthService, OverlayService } from '@core/services';
import { addFASvgIcons } from '@core/utils';
import { AvatarComponent } from '../avatar/avatar.component';
import { MatMenu, MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { CustomOverlayRef } from '@core/components/overlay';
import { RxState } from '@rx-angular/state';
import { isUndefined } from 'lodash';
import { OverlayPositionBuilder } from '@angular/cdk/overlay';
import { AsyncSubject } from 'rxjs';
import { WalletComponent } from '@features/wallet/wallet.component';
import { WalletService } from '@features/wallet/services';

interface State {
    openedMenu?: CustomOverlayRef;
}

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgIf,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule,
        MatMenuModule,
        AvatarComponent,
        TranslocoModule,
        WalletComponent,
        PushModule
    ],
    providers: [RxState, OverlayService, WalletService],
    standalone: true
})
export class HeaderComponent implements AfterViewInit, OnDestroy {
    private breakpointObserver = inject(BreakpointObserver);
    // @ViewChild('menuTemplate', { read: TemplateRef }) menuTemplate!: TemplateRef<HTMLDivElement>;
    // @ViewChild('triggerButton', { read: ElementRef }) triggerButton!: ElementRef;
    // element = inject(ElementRef);
    positionBuilder = inject(OverlayPositionBuilder);
    @ViewChild('wallet', { read: ViewContainerRef }) walletContainer!: ViewContainerRef;
    @ViewChild('menu', { read: MatMenu }) menu!: MatMenu;
    @ViewChild('trigger', { read: MatMenuTrigger }) trigger!: MatMenuTrigger;
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();

    authService = inject(AuthService);
    settingsState = inject(SETTINGS_RX_STATE);
    overlayService = inject(OverlayService);
    isCompact$: Observable<boolean> = this.breakpointObserver
        .observe(['(min-width: 960px)', '(max-width: 959.98px)'])
        .pipe(map(({ breakpoints: { '(max-width: 959.98px)': isCompact } }) => isCompact));

    toggleSidebar() {
        this.settingsState.set('sidebarMode', ({ sidebarMode }) => (sidebarMode === 'compact' ? 'full' : 'compact'));
    }

    constructor(private state: RxState<State>) {
        this.state.connect(
            this.state.select('openedMenu').pipe(
                filter(ref => !isUndefined(ref)),
                switchMap(menuRef => (menuRef as CustomOverlayRef).afterClosed$),
                map(() => ({
                    openedMenu: undefined
                }))
            )
        );
        addFASvgIcons(['bars', 'user', 'gear', 'arrow-right-from-bracket', 'envelope', 'database'], 'far');
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

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }

    // async open() {
    //     if (this.state.get()?.openedMenu) {
    //         await this.state.get().openedMenu?.close(null);
    //         return;
    //     }

    //     const openedMenu = this.overlayService.open({
    //         origin: this.triggerButton.nativeElement,
    //         content: this.menuTemplate,
    //         overlayConfig: {
    //             panelClass: 'uploading-overlay-pane',
    //             hasBackdrop: false,
    //             positionStrategy: this.positionBuilder
    //                 .flexibleConnectedTo(this.triggerButton.nativeElement)
    //                 .withPositions(this.overlayService.getPositions())
    //                 .withTransformOriginOn('.uploading-overlay-pane')
    //                 .withFlexibleDimensions(true)
    //                 .withGrowAfterOpen(true)
    //         }
    //     });
    //     this.state.set({ openedMenu });
    // }
}
