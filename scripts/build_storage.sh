#!/usr/bin/env bash

export DFX_MOC_PATH="$(vessel bin)/moc"

if dfx build storage; then
    dfx generate storage >/dev/null 2>&1
    DEV_PRINCIPAL="$(dfx identity get-principal)"
    dfx canister install storage --argument "principal \"$DEV_PRINCIPAL\"" --mode upgrade --yes
    npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
    node ./scripts/ic.installcode.mjs --type storage
fi

unset DFX_MOC_PATH