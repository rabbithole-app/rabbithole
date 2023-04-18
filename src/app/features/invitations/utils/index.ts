import { fromTimestamp } from '@core/utils';
import { Invite as InviteRaw } from '@declarations/rabbithole/rabbithole.did';
import { Principal } from '@dfinity/principal';
import { formatTCycles } from '@features/wallet/utils/cycles';
import { isNull } from 'lodash';
import { Invite } from '../models';

export function prepareInvite(invite: InviteRaw): Invite {
    const { id, cycles, owner, createdAt, expiredAt } = invite;
    const [status, value] = Object.entries(invite.status)[0] as ['active' | 'expired' | 'used', Principal | null];

    return {
        id,
        cycles,
        cyclesFormatted: formatTCycles(cycles),
        owner: owner.toText(),
        createdAt: fromTimestamp(createdAt),
        expiredAt: fromTimestamp(expiredAt),
        status,
        used: isNull(value) ? undefined : value.toText()
    };
}
