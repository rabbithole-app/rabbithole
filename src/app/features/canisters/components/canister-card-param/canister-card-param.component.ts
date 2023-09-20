import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RxIf } from '@rx-angular/template/if';

@Component({
    selector: 'app-canister-card-param',
    standalone: true,
    imports: [RxIf],
    templateUrl: './canister-card-param.component.html',
    styleUrls: ['./canister-card-param.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanisterCardParamComponent {
    @Input() label!: string;
}
