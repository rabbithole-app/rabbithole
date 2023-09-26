import { inject } from '@angular/core';
import { ProfileService } from '@core/services';
import { selectSlice } from '@rx-angular/state/selections';
import { isNull } from 'lodash';
import { first, map } from 'rxjs/operators';

export const hasProfileGuard = () =>
    inject(ProfileService)
        .select(selectSlice(['profile', 'loaded']))
        .pipe(
            first(({ loaded }) => loaded),
            map(({ profile }) => !isNull(profile))
        );
