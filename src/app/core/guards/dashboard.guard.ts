import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { hasProfileGuard } from '.';

export const dashboardGuard = () => {
    const router = inject(Router);

    return hasProfileGuard().pipe(map(hasProfile => (hasProfile ? true : router.createUrlTree(['/register']))));
};
