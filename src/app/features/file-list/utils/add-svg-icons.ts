import { inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

import { FileListIconsConfig } from '@features/file-list/models';

export function addSvgIcons(config: FileListIconsConfig) {
    const matIconRegistry = inject(MatIconRegistry);
    const domSanitizer = inject(DomSanitizer);
    Object.keys(config.value).forEach(icon => {
        matIconRegistry.addSvgIconInNamespace(config.namespace, icon, domSanitizer.bypassSecurityTrustResourceUrl(`../../../${config.path}${icon}.svg`));
    });
}
