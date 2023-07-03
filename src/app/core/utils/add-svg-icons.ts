import { inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

type FAIconType = 'far' | 'fas' | 'fab';

export function addFASvgIcons(icons: string[], namespace: FAIconType) {
    const fa6path = `../../../assets/icons/fontawesome-6-pro/${{ far: 'regular', fas: 'solid', fab: 'brands' }[namespace]}`;
    const matIconRegistry = inject(MatIconRegistry);
    const domSanitizer = inject(DomSanitizer);
    icons.forEach(icon => {
        matIconRegistry.addSvgIconInNamespace(namespace, icon, domSanitizer.bypassSecurityTrustResourceUrl(`${fa6path}/${icon}.svg`));
    });
}
