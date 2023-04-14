type JournalItemType = 'file' | 'folder';
export type DirectoryColor = 'blue' | 'gray' | 'orange' | 'pink' | 'purple' | 'green' | 'yellow';

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
};

export type DirectoryExtended = Directory &
    ItemsCommonAttrs & {
        children: JournalItem[] | undefined;
    };

export type FileInfoExtended = FileInfo & ItemsCommonAttrs;

export type JournalItem = DirectoryExtended | FileInfoExtended;

export type DirectoryCreate = {
    id: string;
    name: string;
    parentId?: string;
};

export type MenuItemAction = 'open' | 'remove' | 'download';

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
