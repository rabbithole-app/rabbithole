import { DirectoryExtended } from '@features/file-list/models';

export interface DirectoryFlatNode {
    expandable: boolean;
    directory: Pick<DirectoryExtended, 'id' | 'name' | 'parentId' | 'path'>;
    level: number;
    loading: boolean;
    disabled: boolean;
}
