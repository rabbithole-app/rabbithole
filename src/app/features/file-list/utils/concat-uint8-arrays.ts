export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
    const result = new Uint8Array(totalLength);

    if (!arrays.length) return result;
    let length = 0;
    for (const array of arrays) {
        result.set(array, length);
        length += array.length;
    }

    return result;
}
