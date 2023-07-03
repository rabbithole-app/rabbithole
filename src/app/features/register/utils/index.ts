import { formatICP, fromTimestamp } from '@core/utils';
import { Invoice as InvoiceRaw } from '@declarations/rabbithole/rabbithole.did';
import { upperCase } from 'lodash';
import { Invoice, InvoiceStage } from '../models';

export function prepareInvoice(invoice: InvoiceRaw): Invoice {
    const { id, owner, amount, createdAt, expiredAt, stage } = invoice;
    const value = upperCase(Object.keys(stage)[0]).replaceAll(' ', '_');

    return {
        id,
        owner: owner.toText(),
        amount: formatICP(amount.e8s, '0.0-4'),
        createdAt: fromTimestamp(createdAt),
        expiredAt: fromTimestamp(expiredAt),
        stage: InvoiceStage[value as keyof typeof InvoiceStage]
    };
}
