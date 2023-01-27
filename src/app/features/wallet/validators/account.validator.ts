import { AbstractControl, ValidationErrors } from '@angular/forms';
import { isAccountHash, isPrincipal } from '../utils';

export class AccountValidators {
    static address(control: AbstractControl): ValidationErrors | null {
        if (!isPrincipal(control.value) && !isAccountHash(control.value)) {
            return { invalid: true };
        }

        return null;
    }
}
