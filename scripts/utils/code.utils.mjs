import { readFile } from 'fs/promises';

export const loadWasm = async (type, network) => {
    const buffer = await readFile(`${process.cwd()}/.dfx/${network}/canisters/${type}/${type}.wasm`);
    return [...new Uint8Array(buffer)];
};
