import type { Identity } from '@dfinity/agent';
import { KEY_STORAGE_DELEGATION, KEY_STORAGE_KEY } from '@dfinity/auth-client';
import { DelegationChain, DelegationIdentity, ECDSAKeyIdentity, isDelegationValid } from '@dfinity/identity';
import { createStore, getMany } from 'idb-keyval';

export async function initIdentity({ identityKey, delegationChain }: { identityKey: CryptoKeyPair; delegationChain: string }): Promise<Identity> {
    const chain: DelegationChain = DelegationChain.fromJSON(delegationChain);
    const key: ECDSAKeyIdentity = await ECDSAKeyIdentity.fromKeyPair(identityKey);

    return DelegationIdentity.fromDelegation(key, chain);
}

export async function loadIdentity(): Promise<Identity | undefined> {
    const customStore = createStore('auth-client-db', 'ic-keyval');

    const [identityKey, delegationChain] = await getMany([KEY_STORAGE_KEY, KEY_STORAGE_DELEGATION], customStore);

    // No identity key or delegation key for the worker to fetch the cycles
    if (!identityKey || !delegationChain) {
        return undefined;
    }

    // If delegation is invalid, it will be catch by the idle timer
    if (!isDelegationValid(DelegationChain.fromJSON(delegationChain))) {
        return undefined;
    }

    return initIdentity({ identityKey, delegationChain });
}
