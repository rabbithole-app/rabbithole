import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileService } from '@core/services';
import { map } from 'rxjs';

export const invitationsGuard = () => {
    const router = inject(Router);
    return inject(ProfileService)
        .select('canInvite')
        .pipe(map(canInvite => (canInvite ? true : router.createUrlTree(['/drive']))));
};
