import { fromNullable } from '@dfinity/utils';
import { pick } from 'lodash';

import { fromTimestamp } from '@core/utils';
import { SharedFileExtended as SharedFileExtendedRaw } from '@declarations/journal/journal.did';
import { environment } from 'environments/environment';
import { SharedFileExtended } from '../models';

export function toSharedFileExtended(sharedFile: SharedFileExtendedRaw): SharedFileExtended {
    const storageId = sharedFile.storageId.toText();
    const host: string = environment.production ? `https://${storageId}.raw.ic0.app` : `http://${storageId}.localhost:8080`;
    const downloadUrl = `${host}/${sharedFile.id}`;
    const thumbnail = fromNullable(sharedFile.thumbnail);
    const thumbnailUrl = thumbnail ? `${host}/${thumbnail}` : undefined;
    const timelock = fromNullable(sharedFile.timelock);

    return {
        ...pick(sharedFile, ['id', 'name', 'fileSize', 'encrypted', 'sharedWith', 'downloads', 'storageId', 'journalId']),
        thumbnailUrl,
        downloadUrl,
        createdAt: fromTimestamp(sharedFile.createdAt),
        updatedAt: fromTimestamp(sharedFile.updatedAt),
        timelock: timelock ? fromTimestamp(timelock) : undefined,
        limitDownloads: fromNullable(sharedFile.limitDownloads),
        owner: sharedFile.owner.toText()
    };
}
