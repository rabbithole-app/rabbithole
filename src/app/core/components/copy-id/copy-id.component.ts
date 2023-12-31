import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { addFASvgIcons } from '@core/utils';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
    selector: 'app-copy-id',
    templateUrl: './copy-id.component.html',
    styleUrls: ['./copy-id.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatIconModule, MatButtonModule, MatTooltipModule, ClipboardModule, TranslocoModule]
})
export class CopyIDComponent {
    @Input({ required: true }) content = '';
    #clipboard = inject(Clipboard);

    constructor() {
        addFASvgIcons(['copy'], 'far');
    }

    copy(event: MouseEvent) {
        event.stopPropagation();
        this.#clipboard.copy(this.content);
    }
}
