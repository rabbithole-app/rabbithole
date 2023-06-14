import { inject } from '@angular/core';
import { ProfileService } from '@core/services';
import { selectSlice } from '@rx-angular/state/selections';
import { isNull } from 'lodash';
import { filter, map } from 'rxjs';

export const hasProfileGuard = () =>
    inject(ProfileService)
        .select(selectSlice(['profile', 'loaded']))
        .pipe(
            filter(({ loaded }) => loaded),
            map(({ profile }) => !isNull(profile))
        );
