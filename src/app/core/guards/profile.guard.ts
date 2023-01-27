import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ProfileService } from '@core/services';
import { selectSlice } from '@rx-angular/state/selections';
import { isNull } from 'lodash';
import { filter, map } from 'rxjs';

export const hasProfileGuard = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) =>
    inject(ProfileService)
        .select(selectSlice(['profile', 'loaded']))
        .pipe(
            filter(({ loaded }) => loaded),
            map(({ profile }) => !isNull(profile))
        );
