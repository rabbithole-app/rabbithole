export enum InvoiceStage {
    ACTIVE,
    PAID,
    FAILED,
    CREATE_CANISTER,
    NOTIFY_CANISTER,
    INSTALL_JOURNAL,
    TRANSFER_UNUSED_FUNDS,
    COMPLETE
}

export type Invoice = {
    id: string;
    createdAt: Date;
    expiredAt: Date;
    owner: string;
    amount: string;
    stage: InvoiceStage;
};
