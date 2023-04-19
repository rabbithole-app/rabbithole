#!/usr/bin/env bash

export DFX_MOC_PATH="$(vessel bin)/moc"
network="--network ${1:-"local"}"

if dfx build storage $network; then
    dfx generate storage >/dev/null 2>&1
    sed -i'.bak' '/^export const storage/s/^/\/\//g' src/declarations/storage/index.js
    rm src/declarations/storage/index.js.bak
    DEV_PRINCIPAL="$(dfx identity get-principal)"
    dfx canister install storage --argument "principal \"$DEV_PRINCIPAL\"" --mode upgrade --yes
    npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
    node ./scripts/ic.installcode.mjs $network --type storage --concurrent 10
fi

unset DFX_MOC_PATH