import { Directive, forwardRef, inject } from '@angular/core';
import { AbstractControl, AsyncValidator, NG_ASYNC_VALIDATORS, ValidationErrors } from '@angular/forms';
import { UniqueUsernameValidator } from '@core/validators';
import { Observable } from 'rxjs';

@Directive({
    selector: '[appUniqueUsername]',
    standalone: true,
    providers: [
        {
            provide: NG_ASYNC_VALIDATORS,
            useExisting: forwardRef(() => UniqueUsernameValidatorDirective),
            multi: true
        }
    ]
})
export class UniqueUsernameValidatorDirective implements AsyncValidator {
    private validator = inject(UniqueUsernameValidator);

    validate(control: AbstractControl): Observable<ValidationErrors | null> {
        return this.validator.validate(control);
    }
}
