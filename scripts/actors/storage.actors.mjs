import pkgAgent from '@dfinity/agent';
import { idlFactory } from '../../.dfx/local/canisters/storage/service.did.mjs';
import { getLocalHttpAgent } from '../utils/agent.utils.mjs';

const { Actor } = pkgAgent;

export async function storageActorLocal(canisterId) {
    const agent = await getLocalHttpAgent();

    return Actor.createActor(idlFactory, {
        agent,
        canisterId
    });
}
