import pkgAgent from '@dfinity/agent';

import { idlFactory } from '../../.dfx/local/canisters/journal/journal.did.mjs';
import { getICHttpAgent, getLocalHttpAgent } from '../utils/agent.utils.mjs';

const { Actor } = pkgAgent;

export async function journalActorIC(canisterId) {
    const agent = await getICHttpAgent();

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
}

export async function journalActorLocal(canisterId) {
    const agent = await getLocalHttpAgent();

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
}
