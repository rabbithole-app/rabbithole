export const LEDGER_CANISTER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
export const CYCLES_MINTING_CANISTER_ID = 'rkp4c-7iaaa-aaaaa-aaaca-cai';

export const AUTH_POPUP_WIDTH = 576;
export const AUTH_POPUP_HEIGHT = 576;

export const E8S_PER_TOKEN = 100_000_000n;
export const IC_TRANSACTION_FEE_ICP = 10_000n;
export const ONE_TRILLION = 1_000_000_000_000n;

export const JOURNAL_CYCLES_SHARE = 1_000_000_000_000n;
export const AUTH_TIMER_INTERVAL = 1000;
// How long the delegation identity should remain valid?
// e.g. BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000) = 7 days in nanoseconds
export const AUTH_MAX_TIME_TO_LIVE = BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000);

export const APP_DERIVATION_ORIGIN = 'https://dqaj4-oiaaa-aaaap-aazza-cai.icp0.io';
export const APP_ALTERNATIVE_ORIGIN = 'https://rabbithole.app';
