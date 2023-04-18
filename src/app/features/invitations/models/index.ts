export type Invite = {
    id: string;
    cycles: bigint;
    cyclesFormatted: string;
    status: 'active' | 'expired' | 'used';
    used?: string;
    owner: string;
    expiredAt: Date;
    createdAt: Date;
    loading?: boolean;
};
