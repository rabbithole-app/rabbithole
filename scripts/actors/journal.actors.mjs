import pkgAgent from '@dfinity/agent';
import fetch from 'node-fetch';
import { idlFactory } from '../../.dfx/local/canisters/journal/journal.did.mjs';
import { initIdentity } from '../utils/identity.utils.mjs';

const { HttpAgent, Actor } = pkgAgent;

export const journalActorIC = async (canisterId) => {
    const identity = initIdentity();

    const agent = new HttpAgent({ identity, fetch, host: 'https://ic0.app' });

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
};

export const journalActorLocal = async (canisterId) => {
    const identity = initIdentity();

    const agent = new HttpAgent({ identity, fetch, host: 'http://127.0.0.1:8080/' });

    await agent.fetchRootKey();

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
};
