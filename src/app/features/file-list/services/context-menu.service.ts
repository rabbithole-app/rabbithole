import { ElementRef, inject, Injectable } from '@angular/core';
import { Point } from '@angular/cdk/drag-drop';
import { ConnectedPosition, OverlayPositionBuilder, OverlayRef, PositionStrategy } from '@angular/cdk/overlay';
import { MatMenuTrigger } from '@angular/material/menu';
import { asyncScheduler, firstValueFrom } from 'rxjs';
import { RxState } from '@rx-angular/state';
import { has } from 'lodash';

interface State {
    trigger: MatMenuTrigger | null;
    point: Point;
    menuData: unknown;
    origin: ElementRef;
}

@Injectable()
export class ContextMenuService extends RxState<State> {
    private positionBuilder = inject(OverlayPositionBuilder);
    static openedMenu: MatMenuTrigger | null;

    constructor() {
        super();
        this.set({ point: { x: 0, y: 0 } });
    }

    private getPositionStrategy(hasOffset: boolean): PositionStrategy {
        const { point, origin } = this.get();
        const rect = origin.nativeElement.getBoundingClientRect();
        const positions: ConnectedPosition[] = [
            {
                originX: 'start',
                originY: 'bottom',
                overlayX: 'start',
                overlayY: 'top',
                offsetX: hasOffset ? point.x - rect.left : 0,
                offsetY: hasOffset ? point.y - rect.top - rect.height : 0,
                weight: 1
            },
            {
                originX: 'start',
                originY: 'bottom',
                overlayX: 'end',
                overlayY: 'top',
                offsetX: hasOffset ? point.x - rect.left : 0,
                offsetY: hasOffset ? point.y - rect.top - rect.height : 0,
                weight: 2
            },
            {
                originX: 'start',
                originY: 'top',
                overlayX: 'start',
                overlayY: 'bottom',
                offsetX: hasOffset ? point.x - rect.left : 0,
                offsetY: hasOffset ? point.y - rect.top : 0,
                weight: 3
            },
            {
                originX: 'start',
                originY: 'top',
                overlayX: 'end',
                overlayY: 'bottom',
                offsetX: hasOffset ? point.x - rect.left : 0,
                offsetY: hasOffset ? point.y - rect.top : 0,
                weight: 4
            }
        ];

        return this.positionBuilder.flexibleConnectedTo(origin).withPositions(positions).withFlexibleDimensions(false);
    }

    /**
     * Открытие контекстного меню с сохранением активного окна в статической переменной
     * позиция окна перерисовывается при повторном вызове контекстного меню
     *
     * @param state
     */
    async open(state: Partial<State>) {
        this.set(state);
        const { trigger, menuData } = this.get();

        if (trigger) {
            if (!trigger.menuOpen) {
                if (ContextMenuService.openedMenu && ContextMenuService.openedMenu.menuOpen) {
                    this.close();
                    await firstValueFrom(ContextMenuService.openedMenu.menuClosed);
                }

                ContextMenuService.openedMenu = trigger;
                trigger.openMenu();
            }

            trigger.menuData = menuData;
            trigger.menu?.lazyContent?.attach(trigger.menuData);

            asyncScheduler.schedule(() => {
                // другого способа получить доступ к референсу overlay для MatMenu нет
                const overlayRef = trigger['_overlayRef'] as OverlayRef;
                const hasOffset = has(state, 'point');
                overlayRef.updatePositionStrategy(this.getPositionStrategy(hasOffset));
                trigger.menu?.focusFirstItem();
            });
        }
    }

    close() {
        ContextMenuService.openedMenu?.closeMenu();
    }
}
