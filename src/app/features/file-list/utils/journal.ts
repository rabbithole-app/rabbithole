import { fromNullable } from '@dfinity/utils';
import { has, isUndefined } from 'lodash';

import { isDevMode } from '@angular/core';
import { Directory, File, FileExtended, FileShare, DirectoryColor as JournalDirectoryColor } from '@declarations/journal/journal.did.js';
import { DirectoryColor, DirectoryExtended, FileInfoExtended } from '@features/file-list/models';
import { environment } from 'environments/environment';

export const uint8ToBase64 = (arr: Uint8Array): string =>
    btoa(
        Array(arr.length)
            .fill('')
            .map((_, i) => String.fromCharCode(arr[i]))
            .join('')
    );

export const fromNullableOption = <T extends Record<string, null>, K>(value: [] | [T], defaultValue: K): K => {
    const v: T | undefined = fromNullable(value);

    return isUndefined(v) ? defaultValue : (Object.keys(v)[0] as unknown as K);
};

function isFileExtend(item: File | FileExtended): item is FileExtended {
    return has(item, 'share');
}

export function toDirectoryExtended(directory: Directory): DirectoryExtended {
    const children = fromNullable(directory.children);
    let dirs: DirectoryExtended[] = [];
    let files: FileInfoExtended[] = [];

    if (children) {
        dirs = children[0].map(toDirectoryExtended);
        files = children[1].map(toFileExtended);
    }

    return {
        ...directory,
        type: 'folder',
        parentId: fromNullable(directory.parentId),
        color: fromNullableOption<JournalDirectoryColor, DirectoryColor>(directory.color, 'blue'),
        children: children ? [dirs, files] : undefined,
        size: fromNullable(directory.size)
    };
}

export function toFileExtended(file: File | FileExtended): FileInfoExtended {
    const storageId = file.bucketId.toText();
    const host: string = isDevMode() ? `http://${storageId}.localhost:8080` : `https://${storageId}.raw.ic0.app`;
    const downloadUrl = `${host}/${file.id}`;
    const thumbnail = fromNullable(file.thumbnail);
    const thumbnailUrl = thumbnail ? `${host}/${thumbnail}` : undefined;
    let share: FileShare | undefined;
    if (isFileExtend(file)) {
        share = fromNullable(file.share);
    }
    return {
        ...file,
        storageId,
        downloadUrl,
        type: 'file',
        parentId: fromNullable(file.parentId),
        thumbnail,
        thumbnailUrl,
        share
    };
}
