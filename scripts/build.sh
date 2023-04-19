#!/bin/bash

export DFX_MOC_PATH="$(vessel bin)/moc"
network="--network ${1:-"local"}"

if dfx build rabbithole $network; then
    dfx generate rabbithole
    sed -i'.bak' '/^export const rabbithole/s/^/\/\//g' src/declarations/rabbithole/index.js
    rm src/declarations/rabbithole/index.js.bak
    npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
    cp .dfx/local/canisters/rabbithole/rabbithole.did.js .dfx/local/canisters/rabbithole/rabbithole.did.mjs
    dfx canister install rabbithole --mode upgrade $network
    # dfx canister deposit-cycles 1000000000000 rabbithole
fi

unset DFX_MOC_PATH