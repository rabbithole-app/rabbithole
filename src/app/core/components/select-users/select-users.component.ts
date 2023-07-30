import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    Input,
    ViewChild,
    WritableSignal,
    booleanAttribute,
    effect,
    forwardRef,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { RxFor } from '@rx-angular/template/for';
import { RxIf } from '@rx-angular/template/if';
import { RxPush } from '@rx-angular/template/push';
import { Observable, combineLatestWith, fromEvent, map, startWith, take } from 'rxjs';

import { ProfileItem } from '@core/models/profile';
import { ProfileService } from '@core/services';
import { addFASvgIcons } from '@core/utils';
import { UserCardComponent } from '../user-card/user-card.component';

@Component({
    selector: 'app-select-users',
    standalone: true,
    imports: [
        RxIf,
        FormsModule,
        MatFormFieldModule,
        MatChipsModule,
        MatAutocompleteModule,
        ReactiveFormsModule,
        MatIconModule,
        RxPush,
        RxFor,
        UserCardComponent
    ],
    templateUrl: './select-users.component.html',
    styleUrls: ['./select-users.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SelectUsersComponent),
            multi: true
        }
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectUsersComponent implements ControlValueAccessor, AfterViewInit {
    @Input() label = 'Select users';
    @Input() exceptList: string[] = [];
    announcer = inject(LiveAnnouncer);
    control = new FormControl();
    profileService = inject(ProfileService);
    users$: Observable<ProfileItem[]> = toObservable(this.profileService.list).pipe(
        map(list => list.filter(({ principal }) => !this.exceptList.some(p => p === principal)))
    );
    selected: WritableSignal<ProfileItem[]> = signal([]);
    filteredUsers$: Observable<ProfileItem[]> = this.control.valueChanges.pipe(
        startWith(null),
        combineLatestWith(this.users$, toObservable(this.selected)),
        map(([search, users, selected]) => {
            const filteredUsers = search ? users.filter(({ username, principal }) => username.includes(search) || principal.includes(search)) : users;
            return filteredUsers.filter(item => !selected.some(({ username }) => item.username === username));
        })
    );
    @ViewChild('input') input!: ElementRef<HTMLInputElement>;
    @Input({ transform: booleanAttribute }) disabled = false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    onChanged = (value: string[] | null) => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onTouched = () => {};
    #destroyed = inject(DestroyRef);

    constructor() {
        addFASvgIcons(['xmark'], 'far');
        effect(() => {
            const value = this.selected().map(({ principal }) => principal);
            this.onChanged(value.length ? value : null);
        });
    }

    ngAfterViewInit(): void {
        fromEvent(this.input.nativeElement, 'blur', { passive: true })
            .pipe(take(1), takeUntilDestroyed(this.#destroyed))
            .subscribe(() => this.onTouched());
    }

    remove(user: ProfileItem): void {
        this.selected.update(value => value.filter(({ username }) => user.username !== username));
        this.announcer.announce(`Removed ${user.username}`);
    }

    select(event: MatAutocompleteSelectedEvent): void {
        this.selected.update(value => [...value, event.option.value]);
        this.input.nativeElement.value = '';
        this.control.setValue(null);
    }

    writeValue(value: string[] | null): void {
        if (value) {
            this.selected.set(this.profileService.list().filter(({ principal }) => value.some(p => p === principal)));
        } else {
            this.selected.set([]);
        }
    }

    registerOnChange(fn: () => void): void {
        this.onChanged = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
        this.disabled = isDisabled;
        this.control[isDisabled ? 'disable' : 'enable']();
    }
}
