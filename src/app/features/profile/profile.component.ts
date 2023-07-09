import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { fromNullable } from '@dfinity/utils';
import { TranslocoModule } from '@ngneat/transloco';
import { selectSlice } from '@rx-angular/state/selections';
import { RxIf } from '@rx-angular/template/if';
import { isNull, pick } from 'lodash';
import { filter, map } from 'rxjs/operators';

import { AvatarEditorComponent } from '@core/components/avatar-editor/avatar-editor.component';
import { ProfileService } from '@core/services';
import { addFASvgIcons } from '@core/utils';
import { DeleteProfileComponent } from './components/delete-profile/delete-profile.component';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        RxIf,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        ReactiveFormsModule,
        TranslocoModule,
        AvatarEditorComponent
    ],
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
    profileService = inject(ProfileService);
    dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    profileForm = this.fb.group({
        avatarUrl: new FormControl(),
        username: new FormControl({ value: '', disabled: true }),
        displayName: new FormControl('')
    });
    get displayName() {
        return this.profileForm.get('displayName');
    }
    readonly deleteEnabled = false;

    constructor() {
        addFASvgIcons(['floppy-disk', 'user-slash'], 'far');
        this.profileService
            .select(selectSlice(['profile', 'loaded']))
            .pipe(
                filter(({ profile, loaded }) => loaded && !isNull(profile)),
                map(({ profile }) => profile as NonNullable<typeof profile>),
                map(profile => ({ ...pick(profile, ['username', 'displayName']), avatarUrl: fromNullable(profile.avatarUrl) }))
            )
            .subscribe(profile => this.profileForm.patchValue(profile, { emitEvent: false }));
    }

    update() {
        const { avatarUrl, displayName } = this.profileForm.getRawValue();
        this.profileService.update({ avatarUrl, displayName: displayName ?? '' });
    }

    openDeleteDialog(): void {
        const dialogRef = this.dialog.open(DeleteProfileComponent);
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.profileService.delete();
            }
        });
    }
}
