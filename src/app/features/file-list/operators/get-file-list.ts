import { from, Observable, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { last, omit, partition, uniq } from 'lodash';

import { _SERVICE as StorageBucketActor } from '@declarations/storage/storage.did';
import { JournalItem } from '@features/file-list/models';
import { nanoid } from 'nanoid';
// import { BucketActor } from '@core/services';
import { environment } from '../../../../environments/environment';
import { toNullable } from '@dfinity/utils';

/*export function getFileList(folder?: string) {
    return function (source$: Observable<BucketActor<StorageBucketActor>>): Observable<JournalItem[]> {
        return source$.pipe(
            switchMap(({ actor, bucketId }) =>
                from(actor.list(toNullable(folder))).pipe(
                    map(items => {
                        const [currentFolderItems, otherItems] = partition(items, item => item.folder === (folder || ''));
                        const host: string = environment.production ? `https://${bucketId.toText()}.raw.ic0.app` : `http://${bucketId.toText()}.localhost:8000`;
                        // console.log(otherItems.map(v => v.folder.split('/')[0]))
                        const directories = uniq(otherItems.map(v => v.folder.split('/')[0])).map(
                            name =>
                                ({
                                    id: nanoid(),
                                    type: 'folder',
                                    // folder,
                                    name
                                } as JournalItem)
                        );
                        const files = currentFolderItems.map(
                            item =>
                                ({
                                    // ...omit(item, 'token'),
                                    id: item.token[0],
                                    type: 'file'
                                    // extension: last(item.name.split('.')),
                                    // downloadUrl: `${host}${item.fullPath}?token=${item.token[0]}`
                                } as JournalItem)
                        );

                        return [...directories, ...files];
                    })
                )
            )
        );
    };
}*/
