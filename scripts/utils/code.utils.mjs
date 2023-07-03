import { readFile } from 'fs/promises';

export const loadWasm = async type => {
    const buffer = await readFile(`${process.cwd()}/.dfx/local/canisters/${type}/${type}.wasm`);
    return [...new Uint8Array(buffer)];
};
