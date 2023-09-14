import { AccountIdentifier } from '@dfinity/nns';
import { initIdentity } from './identity.utils.mjs';

export const accountIdentifier = (principal) => {
	const identity = initIdentity();

	return AccountIdentifier.fromPrincipal({
		principal: principal ?? identity.getPrincipal()
	});
};