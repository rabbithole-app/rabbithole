import { animate, animation, style } from '@angular/animations';

export const overlayOpenAnimation = animation(
    [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('{{ duration }} cubic-bezier(0.390, 0.575, 0.565, 1.000)', style({ transform: 'scale(1)', opacity: 1 }))
    ],
    { params: { duration: '100ms' } }
);

export const overlayCloseAnimation = animation([animate('{{ duration }} ease-out', style({ opacity: 0 }))], {
    params: { duration: '100ms' }
});
