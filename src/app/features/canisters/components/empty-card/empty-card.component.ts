import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EmptyComponent } from '@core/components/empty/empty.component';

@Component({
    selector: 'app-empty-card',
    standalone: true,
    imports: [MatCardModule, EmptyComponent],
    templateUrl: './empty-card.component.html',
    styleUrls: ['./empty-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyCardComponent {}
