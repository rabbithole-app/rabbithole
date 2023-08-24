import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LogoComponent } from '../dashboard/components/logo/logo.component';
import { SharedFileExtended } from '@features/shared-with-me/models';
import { FileCardComponent } from './components/file-card/file-card.component';

@Component({
    selector: 'app-shared',
    standalone: true,
    imports: [RouterLink, LogoComponent, FileCardComponent],
    templateUrl: './shared.component.html',
    styleUrls: ['./shared.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SharedComponent {
    @Input({ required: true }) data!: SharedFileExtended;
}
