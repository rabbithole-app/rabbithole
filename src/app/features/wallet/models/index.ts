export type ReviewTransaction = {
    from: string;
    to: string;
    amount: string;
    fee: string;
    tokenSymbol: string;
};

export type Send = {
    amount: bigint;
    recipient: string;
};
