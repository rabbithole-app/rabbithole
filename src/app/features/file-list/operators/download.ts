import { numberAttribute } from '@angular/core';
import { isUndefined } from 'lodash';
import { EMPTY, Observable, defer, merge } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { connect, exhaustMap, filter, last, map, repeat, scan, takeWhile } from 'rxjs/operators';

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    let totalLength = arrays.reduce((acc, value) => acc + value.length, 0);

    let result = new Uint8Array(totalLength);

    if (!arrays.length) return result;
    let length = 0;
    for (let array of arrays) {
        result.set(array, length);
        length += array.length;
    }

    return result;
}

export enum DownloadStatus {
    RetrieveKey,
    Progress,
    Decryption,
    Failed,
    Complete
}

export type DownloadProgress = { status: DownloadStatus.Progress; total: number; loaded: number };
export type DownloadComplete = { status: DownloadStatus.Complete; result: Uint8Array; contentType?: string };
export type DownloadFailed = { status: DownloadStatus.Failed };

export function download(url: string): Observable<DownloadProgress | DownloadComplete | DownloadFailed> {
    return fromFetch(url).pipe(
        exhaustMap(response => {
            const reader = response.body?.getReader();
            if (!reader) {
                return EMPTY;
            }
            const contentEncoding = response.headers.get('content-encoding');
            const contentType = response.headers.get('content-type') ?? undefined;
            const contentLength = response.headers.get(contentEncoding ? 'x-file-size' : 'content-length');
            const total = numberAttribute(contentLength);

            return defer(() => reader.read()).pipe(
                repeat(),
                takeWhile(({ done }) => !done),
                filter(({ value }) => !isUndefined(value)),
                connect(shared =>
                    merge(
                        shared.pipe(
                            scan(
                                (acc, { value }) => ({
                                    ...acc,
                                    loaded: acc.loaded + (value as Uint8Array).byteLength
                                }),
                                {
                                    loaded: 0,
                                    total,
                                    status: DownloadStatus.Progress
                                } as DownloadProgress
                            )
                        ),
                        shared.pipe(
                            scan((acc, { value }) => [...acc, value as Uint8Array], [] as Uint8Array[]),
                            last(),
                            map(chunks => ({ status: DownloadStatus.Complete, result: concatUint8Arrays(chunks), contentType } as DownloadComplete))
                        )
                    )
                )
            );
        })
    );
}
