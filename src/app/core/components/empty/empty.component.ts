import { ChangeDetectionStrategy, Component, HostBinding, Input, inject } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

const emptyIcons = ['blockchain', 'error', 'file-not-found', 'files', 'locked-files', 'pack', 'upload'] as const;
type EmptyIcons = (typeof emptyIcons)[number];

@Component({
    selector: 'app-empty',
    templateUrl: './empty.component.html',
    styleUrls: ['./empty.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule]
})
export class EmptyComponent {
    private matIconRegistry = inject(MatIconRegistry);
    private domSanitizer = inject(DomSanitizer);
    @Input() icon: EmptyIcons = 'files';
    readonly icons = emptyIcons;
    @Input() size: 'small' | 'medium' = 'medium';

    constructor() {
        this.icons.forEach(icon =>
            this.matIconRegistry.addSvgIconInNamespace(
                'empty',
                icon,
                this.domSanitizer.bypassSecurityTrustResourceUrl(`../../../assets/icons/empty-state/${icon}.svg`)
            )
        );
    }

    @HostBinding('class') get hostClass(): string {
        return `size-${this.size}`;
    }
}
