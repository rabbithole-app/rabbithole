import { ChangeDetectionStrategy, Component, ElementRef, TemplateRef, ViewChild, inject } from '@angular/core';
import { NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { CustomOverlayRef } from '@core/components/overlay';
import { Overlay, OverlayOutsideClickDispatcher, OverlayPositionBuilder } from '@angular/cdk/overlay';
import { RxState } from '@rx-angular/state';
import { filter, switchMap, map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@ngneat/transloco';
import { IfModule } from '@rx-angular/template/if';
import { MatButtonModule } from '@angular/material/button';
import { isUndefined } from 'lodash';

import { OverlayService } from '@core/services';
import { addFASvgIcons } from '@core/utils';
import { UPLOAD_STATUS } from '@features/upload/models';
import { UploadService } from '@features/upload/services';
import { UploadComponent } from '@features/upload/upload.component';
import { SidebarService } from 'app/layout/dashboard/services/sidebar.service';

interface State {
    openedMenu: CustomOverlayRef;
    triggerButton: ElementRef;
}

@Component({
    selector: 'app-upload-trigger',
    standalone: true,
    imports: [IfModule, NgSwitch, NgSwitchDefault, NgSwitchCase, MatIconModule, MatProgressSpinnerModule, TranslocoModule, UploadComponent, MatButtonModule],
    templateUrl: './upload-trigger.component.html',
    styleUrls: ['./upload-trigger.component.scss'],
    providers: [RxState, OverlayService, { provide: TRANSLOCO_SCOPE, useValue: 'upload' }],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadTriggerComponent {
    @ViewChild('uploadingTemplate', { read: TemplateRef }) uploadingTemplate!: TemplateRef<HTMLDivElement>;
    @ViewChild('triggerButton', { read: ElementRef }) set triggerButton(value: ElementRef) {
        this.state.set({ triggerButton: value });
    }
    get triggerButton(): ElementRef {
        return this.state.get('triggerButton');
    }
    element = inject(ElementRef);
    positionBuilder = inject(OverlayPositionBuilder);
    overlayService = inject(OverlayService);
    overlay = inject(Overlay);
    overlayOutsideClickDispatcher = inject(OverlayOutsideClickDispatcher);
    uploadService = inject(UploadService);
    sidebarService = inject(SidebarService);
    readonly uploadStatus = UPLOAD_STATUS;

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
        addFASvgIcons(['check', 'play', 'circle-exclamation'], 'far');
    }

    async open() {
        let openedMenu = this.state.get('openedMenu');
        if (openedMenu) {
            await openedMenu.close(null);
            return;
        }

        openedMenu = this.overlayService.open({
            origin: this.triggerButton.nativeElement,
            content: this.uploadingTemplate,
            overlayConfig: {
                panelClass: 'uploading-overlay-pane',
                hasBackdrop: false,
                positionStrategy: this.positionBuilder
                    .flexibleConnectedTo(this.triggerButton.nativeElement)
                    .withPositions(this.overlayService.getPositions())
                    .withTransformOriginOn('.uploading-overlay-pane')
                    .withFlexibleDimensions(true)
                    .withGrowAfterOpen(true)
            }
        });
        this.state.set({ openedMenu });
    }
}
