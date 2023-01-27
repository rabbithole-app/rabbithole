import { Component, ChangeDetectionStrategy, ElementRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import anime from 'animejs/lib/anime.es.js';
import { AnimeInstance, DirectionOptions } from 'animejs';
import { has } from 'lodash';

@Component({
    selector: 'app-logo',
    templateUrl: './logo.component.html',
    styleUrls: ['./logo.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class LogoComponent implements OnChanges {
    @Input() expanded!: boolean;
    private element = inject(ElementRef);

    ngOnChanges(changes: SimpleChanges): void {
        if (has(changes, 'expanded')) {
            const { currentValue, firstChange } = changes['expanded'];
            if (firstChange) {
                // если это инициализация компонента, то просто устанавливаем атрибуты
                this.setLogoAttr(currentValue);
            } else {
                this.removeAnimation();
                // иначе анимируем логотип
                currentValue ? this.expandLogo() : this.collapseLogo();
            }
        }
    }

    private removeAnimation() {
        const svg = this.element.nativeElement.querySelector('svg');
        const rabbit = this.element.nativeElement.querySelector('.rabbit');
        anime.remove(svg);
        anime.remove(rabbit);
        anime.remove(this.element.nativeElement.querySelectorAll('.letters path'));
    }

    private async animateLetters(direction: DirectionOptions): Promise<void> {
        const promises = [];
        const letters = {
            'letter-r': 'R-path',
            'letter-a': 'A-path',
            'letter-b': 'B-path',
            'letter-b2': 'B2-path',
            'letter-i': 'I-path',
            'letter-t': 'T-path',
            'letter-h': 'H-path',
            'letter-o': 'O-path',
            'letter-l': 'L-path',
            'letter-e': 'E-path'
        };
        for (const [letterId, pathId] of Object.entries(letters)) {
            const letterPath = anime.path(this.element.nativeElement.querySelector(`path#${pathId}`));
            const letterEl = this.element.nativeElement.querySelector(`path#${letterId}`);
            const animeInstance: AnimeInstance = anime({
                targets: letterEl,
                translateX: letterPath('x'),
                translateY: letterPath('y'),
                opacity: [1, 0],
                easing: 'easeInOutQuart',
                duration: 1000,
                direction
            });
            promises.push(animeInstance.finished);
        }

        await Promise.all(promises);
    }

    private async expandLogo() {
        const svg = this.element.nativeElement.querySelector('svg');
        const rabbit = this.element.nativeElement.querySelector('.rabbit');
        anime({ targets: svg, width: 154, height: 105, viewBox: '0 0 154 105', easing: 'easeOutExpo', duration: 1000 });
        anime({ targets: rabbit, translateX: 0, scale: 1, easing: 'easeOutExpo', duration: 1000 });
        await this.animateLetters('reverse');
    }

    private async collapseLogo() {
        const svg = this.element.nativeElement.querySelector('svg');
        const rabbit = this.element.nativeElement.querySelector('.rabbit');
        await this.animateLetters('normal');
        const rabbitAnimeInstance = anime({ targets: rabbit, translateX: [0, -23], scale: [1, 0.67], duration: 1000, easing: 'easeOutExpo' });
        const svgAnimeInstance = anime({
            targets: svg,
            easing: 'easeOutExpo',
            keyframes: [
                { width: 84, height: 105, viewBox: '0 0 84 105', duration: 500 },
                { width: 84, height: 80, viewBox: '0 0 84 80', duration: 500 }
            ]
        });
        await Promise.all([svgAnimeInstance.finished, rabbitAnimeInstance.finished]);
    }

    private setLogoAttr(expanded: boolean) {
        const svg = this.element.nativeElement.querySelector('svg');
        const rabbit = this.element.nativeElement.querySelector('.rabbit');
        if (expanded) {
            anime.set(svg, { width: 154, height: 105, viewBox: '0 0 154 105' });
            anime.set(rabbit, { translateX: 0, scale: 1 });
        } else {
            anime.set(svg, { width: 84, height: 80, viewBox: '0 0 84 80' });
            anime.set(rabbit, { translateX: -23, scale: 0.67 });
        }
    }
}
