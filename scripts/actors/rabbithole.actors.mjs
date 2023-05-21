import pkgAgent from '@dfinity/agent';
import pkgPrincipal from '@dfinity/principal';
import { readFileSync } from 'fs';
import { idlFactory } from '../../.dfx/local/canisters/rabbithole/rabbithole.did.mjs';
import { getICHttpAgent, getLocalHttpAgent } from '../utils/agent.utils.mjs';

const { Actor } = pkgAgent;
const { Principal } = pkgPrincipal;

function rabbitholePrincipalIC() {
    const buffer = readFileSync('./canister_ids.json');
    const { rabbithole } = JSON.parse(buffer.toString('utf-8'));
    return Principal.fromText(rabbithole.ic);
};

function rabbitholePrincipalLocal() {
    const buffer = readFileSync('./.dfx/local/canister_ids.json');
    const { rabbithole } = JSON.parse(buffer.toString('utf-8'));
    return Principal.fromText(rabbithole.local);
};

export async function rabbitholeActorIC() {
    const canisterId = rabbitholePrincipalIC();
    const agent = await getICHttpAgent();

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
};

export async function rabbitholeActorLocal() {
    const canisterId = rabbitholePrincipalLocal();
    const agent = await getLocalHttpAgent();

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
};
