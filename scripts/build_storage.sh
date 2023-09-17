#!/usr/bin/env bash

. ./scripts/banner.sh

export DFX_MOC_PATH="$(vessel bin)/moc"
network="--network ${1:-"local"}"
mode="--mode ${2:-"upgrade"}"

dfx build storage $network 2>&1 | grep -v "warning\|Use static library"
if [[ ${PIPESTATUS[0]} == 0 ]]; then
    dfx generate storage >/dev/null 2>&1
    sed -i'.bak' '/^export const storage/s/^/\/\//g' src/declarations/storage/index.js
    rm src/declarations/storage/index.js.bak
    DEV_PRINCIPAL="$(dfx identity get-principal)"
    dfx canister install storage --argument "principal \"$DEV_PRINCIPAL\"" $mode --yes
    npx prettier "src/**/*.{js,ts,mo}" --write --log-level silent
    cp .dfx/local/canisters/storage/service.did.js .dfx/local/canisters/storage/service.did.mjs
    node ./scripts/ic.installcode.mjs $network --type storage --concurrent 10 $mode
fi

unset DFX_MOC_PATH