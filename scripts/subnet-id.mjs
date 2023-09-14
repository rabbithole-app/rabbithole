import { Principal } from '@dfinity/principal';
import { getLocalHttpAgent } from './utils/agent.utils.mjs';

async function getSubnetId() {
    const agent = await getLocalHttpAgent();
    const status = await agent.status();
    return Principal.selfAuthenticating(status.root_key).toText();
}

const subnetId = await getSubnetId();
console.log(subnetId);