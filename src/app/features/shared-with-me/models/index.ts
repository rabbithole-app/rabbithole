import { SharedFileExtended as SharedFileExtendedRaw } from '@declarations/journal/journal.did';

export type SharedFileExtended = Omit<
    SharedFileExtendedRaw,
    'createdAt' | 'updatedAt' | 'limitDownloads' | 'timelock' | 'thumbnail' | 'owner' | 'storageId' | 'journalId'
> & {
    createdAt: Date;
    updatedAt: Date;
    thumbnailUrl?: string;
    limitDownloads?: bigint;
    timelock?: Date;
    downloadUrl: string;
    owner: string;
    storageId: string;
    journalId: string;
};
