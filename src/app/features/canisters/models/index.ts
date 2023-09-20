import { CanisterStatusResponse } from '@dfinity/ic-management';

type CanisterStatusCommon = {
    canisterId: string;
    type: 'journal' | 'storage';
    loading: boolean;
};
export type CanisterStatus = 'stopped' | 'stopping' | 'running';
export type CanisterStatusSuccess = CanisterStatusCommon & {
    canisterStatusResponse: CanisterStatusResponse;
    canisterStatus: CanisterStatusFormatted;
};
export type CanisterStatusFailed = CanisterStatusCommon & { errorMessage: string };
export type CanisterStatusResult = CanisterStatusSuccess | CanisterStatusFailed;
export type CanisterStatusFormatted = {
    cycles: string;
    freezingThresholdInCycles: string;
    memorySize: string;
    moduleHash?: string;
    settings: {
        freezingThreshold: string;
        status: CanisterStatus;
        controllers: string[];
    };
};
