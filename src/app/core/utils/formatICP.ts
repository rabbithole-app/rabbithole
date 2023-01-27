import { formatNumber } from '@angular/common';
import { E8S_PER_TOKEN } from '@core/constants';

export const formatICP = (amount: bigint, digitsInfo = '0.0-3'): string => {
    return formatNumber(Number(amount) / Number(E8S_PER_TOKEN), 'en-US', digitsInfo);
};
