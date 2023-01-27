import { formatNumber } from './number';

export const formatICP = (icp: number): string =>
    formatNumber(icp, {
        minFraction: 4,
        maxFraction: 4
    });
