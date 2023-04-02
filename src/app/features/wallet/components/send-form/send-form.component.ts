import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    EventEmitter,
    forwardRef,
    inject,
    Input,
    OnDestroy,
    Output,
    QueryList,
    ViewChildren
} from '@angular/core';
import { NgIf } from '@angular/common';
import { ControlValueAccessor, FormBuilder, FormControl, FormControlStatus, NG_VALUE_ACCESSOR, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { createMask, InputMaskModule, InputmaskOptions } from '@ngneat/input-mask';
import { PushModule } from '@rx-angular/template/push';
import { convertStringToE8s, TokenAmount, Token } from '@dfinity/nns';
import { RxState } from '@rx-angular/state';
import { selectSlice } from '@rx-angular/state/selections';
import { TranslocoModule } from '@ngneat/transloco';
import {
    AsyncSubject,
    combineLatest,
    combineLatestWith,
    defer,
    distinctUntilChanged,
    filter,
    fromEvent,
    iif,
    map,
    merge,
    of,
    switchMap,
    takeUntil,
    withLatestFrom
} from 'rxjs';
import { isEqual, trimEnd } from 'lodash';

import { AccountValidators, AmountAsyncValidator } from '@features/wallet/validators';
import { addFASvgIcons } from '@core/utils';
import { Send } from '@features/wallet/models';
import { E8S_PER_TOKEN } from '@core/constants';

interface State {
    token: Token;
    amount: TokenAmount;
    transactionFee: bigint;
    showMaxButton: boolean;
    maxAmount: string;
    amountMask: InputmaskOptions<string>;
    accountId: string;
    touched: boolean;
    inputs: QueryList<ElementRef>;
    formStatus: FormControlStatus;
}

@Component({
    selector: 'app-send-form',
    standalone: true,
    imports: [NgIf, ReactiveFormsModule, MatFormFieldModule, MatInputModule, InputMaskModule, MatIconModule, MatButtonModule, PushModule, TranslocoModule],
    templateUrl: './send-form.component.html',
    styleUrls: ['./send-form.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SendFormComponent),
            multi: true
        }
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SendFormComponent extends RxState<State> implements ControlValueAccessor, OnDestroy {
    @Input() set token(value: Token) {
        this.set({ token: value });
    }
    get token(): Token {
        return this.get('token');
    }

    @Input() set amount(value: TokenAmount) {
        this.set({ amount: value });
    }
    get amount(): TokenAmount {
        return this.get('amount');
    }

    @Input() set transactionFee(value: bigint) {
        this.set({ transactionFee: value });
    }
    get transactionFee(): bigint {
        return this.get('transactionFee');
    }

    @Output() cancel: EventEmitter<void> = new EventEmitter<void>();
    @Output() review: EventEmitter<void> = new EventEmitter<void>();
    private matIconRegistry = inject(MatIconRegistry);
    private domSanitizer = inject(DomSanitizer);
    private amountAsyncValidator = inject(AmountAsyncValidator);
    private formBuilder = inject(FormBuilder);
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();
    sendFormGroup = this.formBuilder.group({
        amount: new FormControl<string>('', {
            validators: [Validators.required],
            asyncValidators: [this.amountAsyncValidator.validate.bind(this.amountAsyncValidator)],
            nonNullable: true
        }),
        recipient: new FormControl<string>('', {
            validators: [Validators.required, AccountValidators.address],
            nonNullable: true
        })
    });
    onChanged: Function = (value: Send) => {};
    onTouched: Function = () => {};
    @ViewChildren(MatInput, { read: ElementRef }) set inputs(value: QueryList<ElementRef>) {
        this.set({ inputs: value });
    }
    get inputs(): QueryList<ElementRef> {
        return this.get('inputs');
    }

    get placeholder(): string {
        return `0.00000 ${this.tokenSymbol}`;
    }

    get amountControl(): FormControl {
        return this.sendFormGroup.controls.amount;
    }

    get recipientControl(): FormControl {
        return this.sendFormGroup.controls.recipient;
    }

    get tokenSymbol(): string {
        return this.get('token', 'symbol');
    }

    constructor() {
        super();
        this.connect(
            combineLatest([this.select(selectSlice(['amount', 'transactionFee'])), this.amountControl.valueChanges]).pipe(
                map(([{ amount, transactionFee }, v]) => {
                    const bValue: bigint = typeof v === 'string' ? convertStringToE8s(v) : v;
                    const maxAmount = amount.toE8s() - transactionFee;
                    const value = Number(((maxAmount < 0n ? 0n : maxAmount) * 10_000n) / E8S_PER_TOKEN) / 10_000;

                    return {
                        showMaxButton: maxAmount !== bValue,
                        maxAmount: value.toString()
                    };
                })
            )
        );
        this.connect(
            'amountMask',
            this.select('token', 'symbol').pipe(
                map(symbol => {
                    const suffix = ` ${symbol}`;
                    return createMask<string>({
                        alias: 'numeric',
                        digits: 5,
                        suffix,
                        placeholder: '0.00000',
                        rightAlign: false,
                        parser: (value: string) => trimEnd(value, suffix)
                    });
                })
            )
        );
        addFASvgIcons(['arrow-up-to-line', 'arrow-down'], 'far');
        this.matIconRegistry.addSvgIconInNamespace(
            'ic',
            'token',
            this.domSanitizer.bypassSecurityTrustResourceUrl(`../../../../assets/icons/icp-token-light.svg`)
        );
        this.sendFormGroup.valueChanges
            .pipe(
                combineLatestWith(this.sendFormGroup.statusChanges.pipe(filter(status => status.endsWith('VALID')))),
                switchMap(([value, status]) =>
                    iif(
                        () => status === 'VALID',
                        defer(() => {
                            const e8s = value.amount ? convertStringToE8s(value.amount) : 0n;
                            const amount = typeof e8s === 'bigint' ? e8s : 0n;
                            return of<Send>({ recipient: value.recipient as string, amount });
                        }),
                        of(null)
                    )
                ),
                distinctUntilChanged(isEqual),
                takeUntil(this.destroyed)
            )
            .subscribe(value => {
                this.onChanged(value);
            });
        const touched$ = this.select('touched').pipe(filter(v => v));
        this.sendFormGroup.valueChanges
            .pipe(
                withLatestFrom(this.select('inputs')),
                switchMap(([, inputs]) =>
                    fromEvent(
                        inputs.toArray().map(v => v.nativeElement),
                        'blur'
                    )
                ),
                takeUntil(merge(touched$, this.destroyed))
            )
            .subscribe(() => {
                this.set({ touched: true });
                this.onTouched();
            });
        this.connect('formStatus', this.sendFormGroup.statusChanges);
    }

    writeValue(value: Send): void {
        if (value) {
            this.sendFormGroup.setValue(
                {
                    amount: this.amountToString(value.amount),
                    recipient: value.recipient
                },
                { emitEvent: false }
            );
        } else {
            this.sendFormGroup.reset();
        }
    }

    registerOnChange(fn: Function): void {
        this.onChanged = fn;
    }

    registerOnTouched(fn: Function): void {
        this.onTouched = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
        this.sendFormGroup[isDisabled ? 'disable' : 'enable']();
    }

    setMaxAmount(event: MouseEvent) {
        event.preventDefault();
        const value = this.get('maxAmount');
        this.amountControl.setValue(value);
    }

    override ngOnDestroy(): void {
        super.ngOnDestroy();
        this.destroyed.next();
        this.destroyed.complete();
    }

    private amountToString(value: bigint): string {
        const amount = Number((value * 10_000n) / E8S_PER_TOKEN) / 10_000;
        return amount.toString();
    }

    get formStatus(): FormControlStatus {
        return this.get('formStatus');
    }
}