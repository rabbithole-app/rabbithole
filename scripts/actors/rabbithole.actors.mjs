import pkgAgent from '@dfinity/agent';
import pkgPrincipal from '@dfinity/principal';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';
import { idlFactory } from '../../.dfx/local/canisters/rabbithole/rabbithole.did.mjs';
import { initIdentity } from '../utils/identity.utils.mjs';

const { HttpAgent, Actor } = pkgAgent;
const { Principal } = pkgPrincipal;

const rabbitholePrincipalIC = () => {
    const buffer = readFileSync('./canister_ids.json');
    const { rabbithole } = JSON.parse(buffer.toString('utf-8'));
    return Principal.fromText(rabbithole.ic);
};

const rabbitholePrincipalLocal = () => {
    const buffer = readFileSync('./.dfx/local/canister_ids.json');
    const { rabbithole } = JSON.parse(buffer.toString('utf-8'));
    return Principal.fromText(rabbithole.local);
};

export const rabbitholeActorIC = async () => {
    const canisterId = rabbitholePrincipalIC();

    const identity = initIdentity();

    const agent = new HttpAgent({ identity, fetch, host: 'https://ic0.app' });

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
};

export const rabbitholeActorLocal = async () => {
    const canisterId = rabbitholePrincipalLocal();

    const identity = initIdentity();

    const agent = new HttpAgent({ identity, fetch, host: 'http://127.0.0.1:8080/' });

    await agent.fetchRootKey();

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
};
