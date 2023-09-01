#!/usr/bin/env bash

export DFX_MOC_PATH="$(vessel bin)/moc"
network="--network ${1:-"local"}"
mode="--mode ${2:-"upgrade"}"

dfx build journal $network 2>&1 | grep -v "warning\|Use static library"
if [[ ${PIPESTATUS[0]} == 0 ]]; then
    dfx generate journal >/dev/null 2>&1
    sed -i'.bak' '/^export const journal/s/^/\/\//g' src/declarations/journal/index.js
    rm src/declarations/journal/index.js.bak
    DEV_PRINCIPAL=$(dfx identity get-principal)
    dfx canister install journal --argument "principal \"$DEV_PRINCIPAL\"" $mode --yes
    npx prettier "src/**/*.{js,ts,mo}" --write --log-level silent
    cp .dfx/local/canisters/journal/service.did.js .dfx/local/canisters/journal/service.did.mjs
    cp .dfx/local/canisters/rabbithole/service.did.js .dfx/local/canisters/rabbithole/service.did.mjs
    node ./scripts/ic.installcode.mjs $network --type journal --concurrent 10
fi

unset DFX_MOC_PATH