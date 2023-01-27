import pkgIdentity from '@dfinity/identity-secp256k1';
import crypto from 'crypto';
import { readFileSync } from 'fs';

const { Secp256k1KeyIdentity } = pkgIdentity;

/**
 * ! Replicating the dfx identity in a nodejs script is NOT possible at the moment !
 *
 * See: https://forum.dfinity.org/t/using-dfinity-agent-in-node-js/6169/41
 */
export const initIdentity = () => {
    const buffer = readFileSync('/Users/khalik/.config/dfx/identity/default/identity.pem');
    const key = buffer.toString('utf-8');

    const privateKey = crypto.createHash('sha256').update(key).digest('base64');

    return Secp256k1KeyIdentity.fromSecretKey(Buffer.from(privateKey, 'base64'));
};
