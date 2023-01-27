import { AfterViewInit, Directive, ElementRef, EventEmitter, inject, Input, OnDestroy, Output } from '@angular/core';
import { wrapGrid } from 'animate-css-grid';
import { WrapGridArguments, PopmotionEasing } from 'animate-css-grid/dist/types';
import { AsyncSubject, ReplaySubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface WrapGridConfig {
    duration?: number;
    stagger?: number;
    easing?: keyof PopmotionEasing;
}

@Directive({
    selector: '[appAnimateCssGrid]',
    standalone: true
})
export class AnimateCssGridDirective implements AfterViewInit, OnDestroy {
    private elementRef = inject(ElementRef);
    @Input() appAnimateCssGrid: WrapGridConfig = {};
    @Input() set appAnimateCssGridDisabled(value: boolean) {
        this.animationDisabled.next(value);
    }
    @Output() animationStart = new EventEmitter<HTMLElement[]>();
    @Output() animationEnd = new EventEmitter<HTMLElement[]>();

    private gridWrapper!: { unwrapGrid: () => void; forceGridAnimation: () => void };
    private animationDisabled: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();

    ngAfterViewInit(): void {
        const config: WrapGridArguments = {
            ...this.appAnimateCssGrid,
            onStart: animatedChildren => this.animationStart.emit(animatedChildren),
            onEnd: animatedChildren => this.animationEnd.emit(animatedChildren)
        };
        this.animationDisabled
            .asObservable()
            .pipe(takeUntil(this.destroyed))
            .subscribe(disabled => {
                if (disabled) {
                    this.unwrapGrid();
                } else {
                    this.gridWrapper = wrapGrid(this.elementRef.nativeElement, config);
                }
            });
    }

    unwrapGrid(): void {
        if (this.gridWrapper) {
            this.gridWrapper.unwrapGrid();
        }
    }

    forceGridAnimation(): void {
        if (this.gridWrapper) {
            this.gridWrapper.forceGridAnimation();
        }
    }

    ngOnDestroy(): void {
        this.unwrapGrid();
        this.destroyed.next();
        this.destroyed.complete();
    }
}
