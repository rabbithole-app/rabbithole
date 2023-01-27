import { TemplateRef } from '@angular/core';
import { ComponentType, OverlayConfig } from '@angular/cdk/overlay';

export type OverlayContentType = string | TemplateRef<any> | ComponentType<any>;

export interface OverlayParams<T> {
    origin: HTMLElement;
    content: OverlayContentType;
    data?: T;
    overlayConfig?: OverlayConfig;
}

export interface OverlayOpenEvent<T> {
    data?: T;
}

export interface OverlayCloseEvent<R> {
    type: 'backdropClick' | 'close';
    data?: R;
}
