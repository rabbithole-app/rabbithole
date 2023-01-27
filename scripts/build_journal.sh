#!/usr/bin/env bash

if dfx build journal; then
    dfx generate journal >/dev/null 2>&1
    DEV_PRINCIPAL=$(dfx identity get-principal)
    dfx canister install journal --argument "principal \"$DEV_PRINCIPAL\"" --mode reinstall --yes
    # dfx generate journal
    npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
    cp .dfx/local/canisters/journal/journal.did.js .dfx/local/canisters/journal/journal.did.mjs
    cp .dfx/local/canisters/rabbithole/rabbithole.did.js .dfx/local/canisters/rabbithole/rabbithole.did.mjs
    # dfx canister call journal getStorage "0";
    node ./scripts/ic.installcode.mjs --type journal
    # dfx canister call "s55qq-oqaaa-aaaaa-aaakq-cai" depositInfo
    # dfx canister install manager --mode upgrade --yes
    # dfx canister deposit-cycles 1000000000000 rabbithole
fi