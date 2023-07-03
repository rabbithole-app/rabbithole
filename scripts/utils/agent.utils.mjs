import pkgAgent from '@dfinity/agent';
import fetch from 'node-fetch';
import { initIdentity } from './identity.utils.mjs';

const { HttpAgent } = pkgAgent;

export async function getLocalHttpAgent() {
    const identity = initIdentity();
    const agent = new HttpAgent({ identity, fetch, host: 'http://127.0.0.1:8080/' });
    await agent.fetchRootKey();

    return agent;
}

export async function getICHttpAgent() {
    const identity = initIdentity();
    const agent = new HttpAgent({ identity, fetch, host: 'https://ic0.app' });

    return agent;
}
