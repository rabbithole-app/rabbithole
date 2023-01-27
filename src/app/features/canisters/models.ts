import { Principal } from '@dfinity/principal';

export type CanisterStatus = 'stopped' | 'stopping' | 'running';

export type CanisterDetailsRaw = {
    id: Principal;
    cycles: bigint;
    freezingThresholdInCycles: bigint;
    memorySize: bigint;
    moduleHash?: Uint8Array;
    settings: {
        freezingThreshold: bigint;
        status: CanisterStatus;
        controllers: Principal[];
    };
};

export type CanisterDetails = {
    id: string;
    cycles: bigint;
    cyclesFormatted: string;
    freezingThresholdInCycles: string;
    memorySize: string;
    moduleHash?: string;
    settings: {
        freezingThreshold: string;
        status: CanisterStatus;
        controllers: string[];
    };
    lastChecked?: Date;
    lastDonated?: Date;
    storageCost?: string;
};
