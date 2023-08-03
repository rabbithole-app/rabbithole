import { InviteDeleteError } from '@declarations/rabbithole/rabbithole.did';
import { translate } from '@ngneat/transloco';
import { get, has } from 'lodash';
import { MonoTypeOperatorFunction, pipe } from 'rxjs';
import { map } from 'rxjs/operators';

export function mapDeleteInviteError<T>(): MonoTypeOperatorFunction<T> {
    return pipe(
        map(result => {
            if (has(result, 'err')) {
                const [key, value] = Object.entries(get(result, 'err') as InviteDeleteError)[0];
                throw Error(translate(`invites.delete.errors.${key}`, { value }));
            }

            return result;
        })
    );
}
