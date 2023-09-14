#!/usr/bin/env bash

SRC_DIR="src/backend/cmc"
mkdir -p $SRC_DIR
mkdir .dfx/local/canisters/cmc
cp $SRC_DIR/cmc-custom.wasm .dfx/local/canisters/cmc/cmc-custom.wasm

dfx identity new --storage-mode=plaintext minter
dfx identity use minter
MINT_ACC=$(dfx identity get-principal)
MINT_ACC_ID=$(node ./scripts/ledger.account-id.mjs --to did --principal $MINT_ACC)
dfx identity use default
LEDGER_ID=$(dfx canister id ledger)

dfx deploy cmc --specified-id rkp4c-7iaaa-aaaaa-aaaca-cai --argument "(opt record {
    minting_account_id = opt ${MINT_ACC_ID};
    ledger_canister_id = opt principal \"${LEDGER_ID}\";
    governance_canister_id = opt principal \"aaaaa-aa\";
    last_purged_notification = opt 0;
    exchange_rate_canister = null;
})" --yes -qq --upgrade-unchanged

RABBITHOLE=$(dfx canister id rabbithole)
SUBNET_ID=$(node ./scripts/subnet-id.mjs)
dfx canister call cmc set_authorized_subnetwork_list "(record { who = opt principal \"$RABBITHOLE\"; subnets = vec { principal \"$SUBNET_ID\" }})"