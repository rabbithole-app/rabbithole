import { fromNullable } from '@dfinity/utils';
import { isUndefined } from 'lodash';
import { Directory, DirectoryColor as JournalDirectoryColor, File } from '@declarations/journal/journal.did.js';
import { DirectoryColor, DirectoryExtended, FileInfoExtended, JournalItem } from '@features/file-list/models';

export const fromNullableOption = <T extends {}, K>(value: [] | [T], defaultValue: K): K => {
    let v: T | undefined = fromNullable(value);

    return isUndefined(v) ? defaultValue : (Object.keys(v)[0] as unknown as K);
};

export function toDirectoryExtended(directory: Directory): DirectoryExtended {
    return {
        ...directory,
        type: 'folder',
        parentId: fromNullable(directory.parentId),
        color: fromNullableOption<JournalDirectoryColor, DirectoryColor>(directory.color, 'blue'),
        children: fromNullable(directory.children),
        path: fromNullable(directory.path)
    } as DirectoryExtended;
}

export function toFileExtended(file: File): FileInfoExtended {
    // const host: string = environment.production ? `https://${file.bucketId.toText()}.raw.ic0.app` : `http://${file.bucketId.toText()}.localhost:8000`;
    return { ...file, type: 'file', fullPath: file.id, parentId: fromNullable(file.parentId) } as FileInfoExtended;
}
