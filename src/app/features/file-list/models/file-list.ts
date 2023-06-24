import { OptKeys } from '@core/models';
import { DirectoryColor as OptDirectoryColor } from '@declarations/journal/journal.did';

export type JournalItemType = 'file' | 'folder';
export type DirectoryColor = OptKeys<OptDirectoryColor>;

type ItemsCommonAttrs = {
    loading?: boolean;
    disabled?: boolean;
};

export type Directory = {
    id: string;
    name: string;
    color: DirectoryColor;
    // createdAt: bigint;
    // updatedAt: bigint;
    type: 'folder';
    parentId?: string;
    path?: string;
    // children: JournalItem[];
};

export type FileInfo = {
    id: string;
    name: string;
    type: 'file';
    fileSize: bigint;
    parentId?: string;
    path?: string;
    bucketId: string;
    downloadUrl: string;
    thumbnail?: string;
};

export type DirectoryExtended = Directory &
    ItemsCommonAttrs & {
        children?: [DirectoryExtended[], FileInfoExtended[]];
    };

export type FileInfoExtended = FileInfo & ItemsCommonAttrs;

export type JournalItem = DirectoryExtended | FileInfoExtended;

export type DirectoryCreate = {
    name: string;
    parent?: { id: string; path: string };
};

export type MenuItemAction = 'open' | 'remove' | 'download' | 'share';

export interface FileListIconsConfig {
    namespace: string;
    value: Record<string, string[]>;
    path: string;
}

export type JournalResult = {
    id: [] | [string];
    files: File[];
    dirs: Directory[];
    breadcrumbs: Directory[];
};
