#!/bin/bash

if dfx build rabbithole; then
    dfx generate rabbithole
    sed -i'.bak' '/^export const rabbithole/s/^/\/\//g' src/declarations/rabbithole/index.js
    rm src/declarations/rabbithole/index.js.bak
    npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
    cp .dfx/local/canisters/rabbithole/rabbithole.did.js .dfx/local/canisters/rabbithole/rabbithole.did.mjs
    dfx canister install rabbithole --mode upgrade --yes
    # dfx canister deposit-cycles 1000000000000 rabbithole
fi