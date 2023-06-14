import { inject, Injectable, Injector } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ConnectedPosition, Overlay, OverlayConfig, OverlayOutsideClickDispatcher, OverlayPositionBuilder, PositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { AnimationBuilder } from '@angular/animations';
import { take } from 'rxjs/operators';

import { OverlayParams } from '@core/models';
import { CustomOverlayRef, OverlayComponent } from '@core/components/overlay';

@Injectable()
export class OverlayService {
    private overlayOutsideClickDispatcher = inject(OverlayOutsideClickDispatcher);
    private overlay = inject(Overlay);
    private injector = inject(Injector);
    private positionBuilder = inject(OverlayPositionBuilder);
    private animationBuilder = inject(AnimationBuilder);
    document = inject(DOCUMENT);

    private getOverlayConfig(origin: HTMLElement, overlayConfig: OverlayConfig = {}): OverlayConfig {
        return new OverlayConfig({
            hasBackdrop: true,
            backdropClass: 'overlay-backdrop',
            positionStrategy: this.getPositionStrategy(origin),
            scrollStrategy: this.overlay.scrollStrategies.reposition({
                autoClose: false
            }),
            ...overlayConfig
        });
    }

    private getPositionStrategy(origin: HTMLElement): PositionStrategy {
        return this.positionBuilder
            .flexibleConnectedTo(origin)
            .withPositions(this.getPositions())
            .withPush(false)
            .withGrowAfterOpen(true)
            .withFlexibleDimensions(false);
    }

    getPositions(): ConnectedPosition[] {
        return [
            {
                originX: 'start',
                originY: 'bottom',
                overlayX: 'start',
                overlayY: 'top',
                weight: 1
            },
            {
                originX: 'center',
                originY: 'bottom',
                overlayX: 'center',
                overlayY: 'top',
                weight: 2
            },
            {
                originX: 'end',
                originY: 'bottom',
                overlayX: 'end',
                overlayY: 'top',
                weight: 3
            }
        ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    open<R = any, T = any>({ origin, content, data, overlayConfig }: OverlayParams<T>): CustomOverlayRef<R> {
        const overlayRef = this.overlay.create(this.getOverlayConfig(origin, overlayConfig));
        const customOverlayRef = new CustomOverlayRef<R, T>(overlayRef, origin, content, data, this.animationBuilder, this.document);
        const injector = this.createInjector(customOverlayRef);
        overlayRef.attach(new ComponentPortal(OverlayComponent, null, injector));
        this.overlayOutsideClickDispatcher.add(overlayRef);
        customOverlayRef.afterClosed$.pipe(take(1)).subscribe(() => {
            this.overlayOutsideClickDispatcher.remove(overlayRef);
        });

        return customOverlayRef;
    }

    createInjector(ref: CustomOverlayRef) {
        return Injector.create({
            providers: [
                {
                    provide: CustomOverlayRef,
                    useValue: ref
                }
            ],
            parent: this.injector
        });
    }
}
