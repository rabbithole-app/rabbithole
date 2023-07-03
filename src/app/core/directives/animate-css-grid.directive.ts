import { computed, Directive, effect, ElementRef, EventEmitter, inject, Input, OnDestroy, Output, Signal, signal, WritableSignal } from '@angular/core';
import { wrapGrid } from 'animate-css-grid';
import { PopmotionEasing, WrapGridArguments } from 'animate-css-grid/dist/types';

export interface WrapGridConfig {
    duration?: number;
    stagger?: number;
    easing?: keyof PopmotionEasing;
}

@Directive({
    selector: '[appAnimateCssGrid]',
    standalone: true
})
export class AnimateCssGridDirective implements OnDestroy {
    readonly #elementRef = inject(ElementRef);
    #animationEnabled: WritableSignal<boolean> = signal(true);
    #config: WritableSignal<WrapGridArguments> = signal({
        onStart: animatedChildren => this.animationStart.emit(animatedChildren),
        onEnd: animatedChildren => this.animationEnd.emit(animatedChildren)
    });
    @Input() set appAnimateCssGrid(value: WrapGridConfig) {
        this.#config.update(config => ({ ...config, ...value }));
    }
    @Input() set appAnimateCssGridDisabled(value: boolean) {
        this.#animationEnabled.set(!value);
    }
    @Output() animationStart = new EventEmitter<HTMLElement[]>();
    @Output() animationEnd = new EventEmitter<HTMLElement[]>();

    #gridWrapper: Signal<{ unwrapGrid: () => void; forceGridAnimation: () => void } | null> = computed(() => {
        if (this.#animationEnabled()) {
            return wrapGrid(this.#elementRef.nativeElement, this.#config());
        }

        return null;
    });

    constructor() {
        effect(() => {
            if (!this.#animationEnabled()) {
                this.unwrapGrid();
            }
        });
    }

    unwrapGrid(): void {
        this.#gridWrapper()?.unwrapGrid();
    }

    forceGridAnimation(): void {
        this.#gridWrapper()?.forceGridAnimation();
    }

    ngOnDestroy(): void {
        this.unwrapGrid();
    }
}
