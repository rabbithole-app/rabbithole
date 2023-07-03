import { AfterContentInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, Renderer2, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

const resizeObservable = (el: HTMLElement): Observable<ResizeObserverEntry> =>
    new Observable(subscriber => {
        const observer = new ResizeObserver(entries => subscriber.next(entries[0]));
        observer.observe(el);
        return () => observer.unobserve(el);
    });

@Component({
    selector: 'app-middle-ellipsis',
    standalone: true,
    template: `<ng-content></ng-content>`,
    styles: [
        `
            :host {
                word-break: keep-all;
                overflow-wrap: normal;
            }
        `
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MiddleEllipsisComponent implements OnInit, AfterContentInit {
    #element = inject(ElementRef);
    #renderer = inject(Renderer2);
    #originalContent: WritableSignal<string> = signal('');
    #destroyed = inject(DestroyRef);

    ngOnInit(): void {
        if (this.#element.nativeElement.children.length) {
            throw new Error('Content must be text');
        }
    }

    ngAfterContentInit(): void {
        this.#originalContent.set(this.#element.nativeElement.textContent.trim());
        resizeObservable(this.#element.nativeElement)
            .pipe(takeUntilDestroyed(this.#destroyed))
            .subscribe(() => {
                let text = this.#element.nativeElement.textContent.trim();
                const width = this.#element.nativeElement.offsetWidth;
                const containerWidth = this.#element.nativeElement.parentNode.offsetWidth;
                if (containerWidth < width) {
                    const txtChars = text.length;
                    const avgLetterSize = width / txtChars;
                    const delEachSide = ((width - containerWidth) / avgLetterSize + 3) / 2;
                    const endLeft = Math.floor(txtChars / 2 - delEachSide);
                    const startRight = Math.ceil(txtChars / 2 + delEachSide);
                    text = `${text.slice(0, endLeft)}...${text.slice(startRight)}`;
                }

                this.#renderer.setProperty(this.#element.nativeElement, 'textContent', text);
            });
    }
}
