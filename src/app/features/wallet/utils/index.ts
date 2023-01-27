export * from './cycles';
export * from './icp';
export * from './number';

import { Principal } from '@dfinity/principal';
import crc32 from 'buffer-crc32';

export const isPrincipal = (principal: string): boolean => {
    try {
        Principal.fromText(principal);
        return true;
    } catch (_) {
        return false;
    }
};

export const isAccountHash = (address: string) => {
    const buff = Buffer.from(address, 'hex');
    const checksum = Buffer.from(Uint8Array.prototype.slice.call(buff, 0, 4));
    const hash = Buffer.from(Uint8Array.prototype.slice.call(buff, 4));
    const checksumFromHash = crc32(hash);
    return arraybufferEqual(checksum.buffer, checksumFromHash.buffer);
};

export const arraybufferEqual = (buf1: ArrayBuffer, buf2: ArrayBuffer) => {
    if (buf1 === buf2) {
        return true;
    }

    if (buf1.byteLength !== buf2.byteLength) {
        return false;
    }

    const view1 = new DataView(buf1);
    const view2 = new DataView(buf2);

    let i = buf1.byteLength;
    while (i--) {
        if (view1.getUint8(i) !== view2.getUint8(i)) {
            return false;
        }
    }

    return true;
};
