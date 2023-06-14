/* eslint-disable  @typescript-eslint/no-explicit-any */
import { TemplateRef, Type } from '@angular/core';
import { OverlayRef } from '@angular/cdk/overlay';
import { AnimationBuilder, AnimationFactory, AnimationPlayer, useAnimation } from '@angular/animations';
import { AsyncSubject, fromEvent, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { overlayCloseAnimation, overlayOpenAnimation } from '@core/animations';
import { OverlayCloseEvent, OverlayOpenEvent } from '@core/models';

// R = Response Data Type, T = тип переданных данных
export class CustomOverlayRef<R = any, T = any> {
    private beforeOpened = new AsyncSubject<OverlayOpenEvent<T>>();
    beforeOpened$ = this.beforeOpened.asObservable();
    private afterOpened = new AsyncSubject<OverlayOpenEvent<T>>();
    afterOpened$ = this.afterOpened.asObservable();
    private beforeClosed = new AsyncSubject<OverlayCloseEvent<R>>();
    beforeClosed$ = this.beforeClosed.asObservable();
    private afterClosed = new AsyncSubject<OverlayCloseEvent<R>>();
    afterClosed$ = this.afterClosed.asObservable();
    private animationStart = new Subject<void>();
    animationStart$ = this.animationStart.asObservable();
    private animationDone = new Subject<void>();
    animationDone$ = this.animationDone.asObservable();
    private openAnimation: AnimationFactory;
    private closeAnimation: AnimationFactory;

    constructor(
        public overlay: OverlayRef,
        public origin: HTMLElement,
        public content: string | TemplateRef<any> | Type<any>,
        public data: T | undefined, // передача данных в overlay,
        public animationBuilder: AnimationBuilder,
        public document: Document
    ) {
        const overlayConfig = overlay.getConfig();
        const callback = () => this._close({ type: 'backdropClick' });

        if (overlayConfig.hasBackdrop) {
            overlay.backdropClick().pipe(takeUntil(this.afterClosed)).subscribe(callback);
        } else {
            fromEvent<MouseEvent>(this.document, 'click', { passive: true })
                .pipe(
                    filter(event => {
                        const clickTarget = event.target as HTMLElement;
                        return clickTarget !== origin && !origin.contains(clickTarget) && !!overlay && !overlay.overlayElement.contains(clickTarget);
                    }),
                    takeUntil(this.afterClosed)
                )
                .subscribe(callback);
        }

        this.openAnimation = animationBuilder.build(useAnimation(overlayOpenAnimation));
        this.closeAnimation = animationBuilder.build(useAnimation(overlayCloseAnimation));
        this._open();
    }

    private async _open(): Promise<void> {
        const openPayload = { data: this.data };
        this.beforeOpened.next(openPayload);
        this.beforeOpened.complete();
        await this.animateOpen();
        this.afterOpened.next(openPayload);
        this.afterOpened.complete();
    }

    private async _close(payload: OverlayCloseEvent<R>) {
        this.beforeClosed.next(payload);
        this.beforeClosed.complete();
        await this.animateClose();
        this.overlay.dispose();
        this.afterClosed.next(payload);
        this.afterClosed.complete();
    }

    playAnimation(player: AnimationPlayer): Promise<void> {
        return new Promise(resolve => {
            player.play();
            player.onStart(() => {
                this.animationStart.next();
            });
            player.onDone(() => {
                this.animationDone.next();
                player.destroy();
                resolve();
            });
        });
    }

    async animateOpen(): Promise<void> {
        const player = this.openAnimation.create(this.overlay.overlayElement);
        await this.playAnimation(player);
    }

    async animateClose(): Promise<void> {
        const player = this.closeAnimation.create(this.overlay.overlayElement);
        await this.playAnimation(player);
    }

    async close(data?: R) {
        await this._close({ type: 'close', data });
    }
}
