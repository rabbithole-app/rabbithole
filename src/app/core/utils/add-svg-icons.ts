import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { inject } from '@angular/core';

type FAIconType = 'far' | 'fas';

export function addFASvgIcons(icons: string[], namespace: FAIconType) {
    const fa6path = `../../../assets/icons/fontawesome-6-pro/${{ far: 'regular', fas: 'solid' }[namespace]}`;
    const matIconRegistry = inject(MatIconRegistry);
    const domSanitizer = inject(DomSanitizer);
    icons.forEach(icon => {
        matIconRegistry.addSvgIconInNamespace(namespace, icon, domSanitizer.bypassSecurityTrustResourceUrl(`${fa6path}/${icon}.svg`));
    });
}
