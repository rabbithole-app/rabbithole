import { translate } from '@ngneat/transloco';
import { map, MonoTypeOperatorFunction, pipe } from 'rxjs';
import { get, has } from 'lodash';
import { formatICP } from '@core/utils';
import { NotifyError, Tokens, TransferError } from '@declarations/journal/journal.did';

export function mapLedgerError<T>(): MonoTypeOperatorFunction<T> {
    return pipe(
        map(result => {
            if (has(result, 'err.notify')) {
                const [key, value] = Object.entries(get(result, 'err.notify') as NotifyError)[0];
                throw Error(translate(`common.cmc.notify.errors.${key}`, { value }));
            } else if (has(result, 'err.transfer')) {
                const entry = Object.entries(get(result, 'err.transfer') as TransferError)[0];
                const key = entry[0];
                let value = entry[1];
                if (key === 'InsufficientFunds') {
                    value = `${formatICP(value.balance.e8s)} ICP`;
                }
                throw Error(translate(`common.ledger.transfer.errors.${key}`, { value }));
            } else if (has(result, 'err.insufficientFunds')) {
                const value = get(result, 'err.insufficientFunds') as { balance: Tokens };
                const balance = `${formatICP(value.balance.e8s)} ICP`;
                throw Error(translate(`common.ledger.transfer.errors.InsufficientFunds`, { value: balance }));
            }

            return result;
        })
    );
}
