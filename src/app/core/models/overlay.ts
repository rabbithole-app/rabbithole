import { ComponentType, OverlayConfig } from '@angular/cdk/overlay';
import { TemplateRef } from '@angular/core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
