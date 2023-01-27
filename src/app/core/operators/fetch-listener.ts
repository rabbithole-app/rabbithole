import { Observable } from 'rxjs';
import { FetchInterceptor } from '@mswjs/interceptors/lib/interceptors/fetch';

export const fetchListener = (eventName: 'request' | 'response') =>
    new Observable(subscriber => {
        const interceptor = new FetchInterceptor();
        interceptor.apply();
        interceptor.on(eventName, (...args: any[]) => {
            subscriber.next(args);
        });

        return () => interceptor.dispose();
    });
