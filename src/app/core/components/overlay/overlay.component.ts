import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, TemplateRef } from '@angular/core';

import { CustomOverlayRef } from '@core/components/overlay/custom-overlay-ref';
import { OverlayContentType } from '@core/models/overlay';

@Component({
    template: `
        <ng-container [ngSwitch]="contentType">
            <ng-container *ngSwitchCase="'string'">
                <div [innerHTML]="content"></div>
            </ng-container>
            <ng-container *ngSwitchCase="'template'">
                <ng-container *ngTemplateOutlet="$any(content); context: context"></ng-container>
            </ng-container>
            <ng-container *ngSwitchCase="'component'">
                <ng-container *ngComponentOutlet="$any(content)"></ng-container>
            </ng-container>
        </ng-container>
    `,
    imports: [CommonModule],
    standalone: true
})
export class OverlayComponent<T> implements OnInit {
    contentType!: 'template' | 'string' | 'component';
    content!: OverlayContentType;
    context!: { close: (data: T) => Promise<void>; data: T };
    private ref = inject(CustomOverlayRef);

    // @HostBinding('class.mat-elevation-z4') shadow = true;

    close() {
        this.ref.close(null);
    }

    ngOnInit() {
        this.content = this.ref.content;

        if (typeof this.content === 'string') {
            this.contentType = 'string';
        } else if (this.content instanceof TemplateRef) {
            this.contentType = 'template';
            this.context = {
                close: this.ref.close.bind(this.ref),
                data: this.ref.data
            };
        } else {
            this.contentType = 'component';
        }
    }
}
