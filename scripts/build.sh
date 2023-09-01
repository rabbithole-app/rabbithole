#!/bin/bash

export DFX_MOC_PATH="$(vessel bin)/moc"
network="--network ${1:-"local"}"
mode="--mode ${2:-"upgrade"}"

dfx build rabbithole $network 2>&1 | grep -v "warning\|Use static library"
if [[ ${PIPESTATUS[0]} == 0 ]]; then
    dfx generate rabbithole
    sed -i'.bak' '/^export const rabbithole/s/^/\/\//g' src/declarations/rabbithole/index.js
    rm src/declarations/rabbithole/index.js.bak
    npx prettier "src/**/*.{js,ts,mo}" --write --log-level silent
    cp .dfx/local/canisters/rabbithole/service.did.js .dfx/local/canisters/rabbithole/service.did.mjs
    dfx canister install rabbithole $mode $network
    # dfx canister deposit-cycles 1000000000000 rabbithole
fi

unset DFX_MOC_PATH