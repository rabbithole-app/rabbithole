// Source: https://github.com/buildwithjuno/juno/blob/main/scripts/ledger.balance.mjs

import { IcrcLedgerCanister } from '@dfinity/ledger';
import { Principal } from '@dfinity/principal';
import { getICHttpAgent, getLocalHttpAgent } from './utils/agent.utils.mjs';
import { LEDGER_CANISTER_ID } from './env.mjs';
import { initIdentity } from './utils/identity.utils.mjs';
import { accountIdentifier } from './utils/ledger.utils.mjs';

const getBalance = async (mainnet) => {
	const agent = await (mainnet ? getICHttpAgent : getLocalHttpAgent)();

	const { balance } = IcrcLedgerCanister.create({
		agent,
		canisterId: LEDGER_CANISTER_ID
	});

	const owner = initIdentity().getPrincipal();

	const e8sBalance = await balance({
		owner,
		certified: false
	});

	const E8S_PER_ICP = 100_000_000n;
	const formatE8sICP = (balance) => `${balance / E8S_PER_ICP} ICP`;

	console.log(formatE8sICP(e8sBalance), '|', e8sBalance);

	const identifier = accountIdentifier(mainnet);

	console.log(identifier.toHex());
};

const mainnet = process.argv.find((arg) => arg.indexOf(`--mainnet`) > -1) !== undefined;

await getBalance(mainnet);
