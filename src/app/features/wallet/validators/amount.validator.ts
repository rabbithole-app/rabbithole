import { inject, Injectable } from '@angular/core';
import { AbstractControl, AsyncValidator, ValidationErrors } from '@angular/forms';
// import { ACCOUNT_RX_STATE } from '@core/stores';
import { convertStringToE8s } from '@dfinity/nns';
import { combineLatest, first, firstValueFrom, map, Observable, shareReplay, tap } from 'rxjs';
import { WalletService } from '../services';

@Injectable()
export class AmountAsyncValidator implements AsyncValidator {
    // private accountState = inject(ACCOUNT_RX_STATE);
    private walletService = inject(WalletService);
    // static createAmountValidator(state: RxState<AccountState>): AsyncValidatorFn {
    //   return (control: AbstractControl): Promise<ValidationErrors | null> =>
    //     firstValueFrom(state.select('balance').pipe(
    //       map(amount =>
    //         control.value > amount.toE8s() ? { amount: true } : null
    //       ),
    //       tap(console.log)
    //     ));
    // }

    validate(control: AbstractControl): Observable<ValidationErrors | null> | Promise<ValidationErrors | null> {
        return combineLatest([this.walletService.select('icpAmount'), this.walletService.select('transactionFee')]).pipe(
            first(),
            // tap(v => console.log('validate', v)),
            map(([amount, transactionFee]) => {
                let value = control.value;

                if (typeof value === 'string') {
                    value = convertStringToE8s(value);
                }

                return value + transactionFee > amount.toE8s() ? { amount: true } : null;
            })
            // shareReplay(1)
        );
    }
}
