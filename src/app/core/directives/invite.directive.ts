import { Directive, forwardRef, inject } from '@angular/core';
import { AbstractControl, AsyncValidator, NG_ASYNC_VALIDATORS, ValidationErrors } from '@angular/forms';
import { InviteValidator } from '@core/validators';
import { Observable } from 'rxjs';

@Directive({
    selector: '[appUniqueInvite]',
    standalone: true,
    providers: [
        {
            provide: NG_ASYNC_VALIDATORS,
            useExisting: forwardRef(() => InviteValidatorDirective),
            multi: true
        }
    ]
})
export class InviteValidatorDirective implements AsyncValidator {
    private validator = inject(InviteValidator);

    validate(control: AbstractControl): Observable<ValidationErrors | null> {
        return this.validator.validate(control);
    }
}
