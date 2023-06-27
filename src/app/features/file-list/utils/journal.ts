import { fromNullable } from '@dfinity/utils';
import { isUndefined } from 'lodash';
import { Directory, DirectoryColor as JournalDirectoryColor, File } from '@declarations/journal/journal.did.js';
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
        path: fromNullable(directory.path),
        size: fromNullable(directory.size)
    };
}

export function toFileExtended(file: File): FileInfoExtended {
    const bucketId = file.bucketId.toText();
    const host: string = environment.production ? `https://${bucketId}.raw.ic0.app` : `http://${bucketId}.localhost:8080`;
    const downloadUrl = `${host}/${file.id}`;
    return {
        ...file,
        bucketId,
        downloadUrl,
        type: 'file',
        parentId: fromNullable(file.parentId),
        thumbnail: fromNullable(file.thumbnail),
        path: fromNullable(file.path)
    } as FileInfoExtended;
}
