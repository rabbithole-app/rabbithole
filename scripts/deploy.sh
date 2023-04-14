#!/bin/bash

export DFX_MOC_PATH="$(vessel bin)/moc"
DEV_PRINCIPAL=$(dfx identity get-principal)

dfx canister create --all
if dfx build rabbithole; then
    dfx generate rabbithole >/dev/null 2>&1
    dfx canister install rabbithole
fi

if dfx build journal; then
    dfx generate journal >/dev/null 2>&1
    dfx canister install journal --argument "principal \"$DEV_PRINCIPAL\""
fi

if dfx build storage; then
    dfx generate storage >/dev/null 2>&1
    dfx canister install storage --argument "principal \"$DEV_PRINCIPAL\""
fi

npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
for f in $(find src/declarations -type f -name index.js)
    do 
        canister=$(basename $(dirname "$f"))
        sed -i'.bak' "/^export const $canister/s/^/\/\//g" "$f"
        rm "$f.bak"
    done
cp .dfx/local/canisters/rabbithole/rabbithole.did.js .dfx/local/canisters/rabbithole/rabbithole.did.mjs

unset DFX_MOC_PATH