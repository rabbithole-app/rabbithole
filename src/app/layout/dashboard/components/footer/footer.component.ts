import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { environment } from 'environments/environment';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    imports: [CommonModule, MatIconModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class FooterComponent {
    isProd = environment.production;
    appName = environment.appName;
    envName = environment.envName;
    version = environment.versions.app;
    year = new Date().getFullYear();
    private matIconRegistry = inject(MatIconRegistry);
    private domSanitizer = inject(DomSanitizer);

    constructor() {
        // matIconRegistry.addSvgIcon('poweredByBadge', domSanitizer.bypassSecurityTrustResourceUrl('../../../assets/ic-badge-powered-by_slim-bg-white.svg'));
        this.matIconRegistry.addSvgIconInNamespace(
            'ic',
            'fullyOnChain',
            this.domSanitizer.bypassSecurityTrustResourceUrl('../../../assets/fully_on_chain-stripe-dark_text.svg')
        );
    }
}
