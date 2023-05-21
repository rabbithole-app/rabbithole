import { InjectionToken } from '@angular/core';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';

export const FETCH_INTERCEPTOR = new InjectionToken<FetchInterceptor>('FETCH_INTERCEPTOR', {
    providedIn: 'root',
    factory: () => {
        const interceptor = new FetchInterceptor();
        interceptor.apply();
        return interceptor;
    }
});
