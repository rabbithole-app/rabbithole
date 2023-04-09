#!/usr/bin/env bash

export DFX_MOC_PATH="$(vessel bin)/moc"

if dfx build journal; then
    dfx generate journal >/dev/null 2>&1
    DEV_PRINCIPAL=$(dfx identity get-principal)
    dfx canister install journal --argument "principal \"$DEV_PRINCIPAL\"" --mode reinstall --yes
    npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
    cp .dfx/local/canisters/journal/journal.did.js .dfx/local/canisters/journal/journal.did.mjs
    cp .dfx/local/canisters/rabbithole/rabbithole.did.js .dfx/local/canisters/rabbithole/rabbithole.did.mjs
    node ./scripts/ic.installcode.mjs --type journal
fi

unset DFX_MOC_PATH