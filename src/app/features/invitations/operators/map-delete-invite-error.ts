import { translate } from '@ngneat/transloco';
import { map, MonoTypeOperatorFunction, pipe } from 'rxjs';
import { get, has } from 'lodash';
import { InviteDeleteError } from '@declarations/rabbithole/rabbithole.did';

export function mapDeleteInviteError<T>(): MonoTypeOperatorFunction<T> {
    return pipe(
        map(result => {
            if (has(result, 'err')) {
                let [key, value] = Object.entries(get(result, 'err') as InviteDeleteError)[0];
                throw Error(translate(`invites.delete.errors.${key}`, { value }));
            }

            return result;
        })
    );
}
