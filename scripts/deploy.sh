#!/bin/bash

export DFX_MOC_PATH="$(vessel bin)/moc"
DEV_PRINCIPAL=$(dfx identity get-principal)

# dfx canister create vetkd_system_api --specified-id s55qq-oqaaa-aaaaa-aaakq-canister
dfx deploy vetkd_system_api
dfx deploy rabbithole
dfx deploy journal --argument "principal \"$DEV_PRINCIPAL\""
dfx deploy storage --argument "principal \"$DEV_PRINCIPAL\""

npx prettier "src/**/*.{js,ts,mo}" --write --loglevel silent
for f in $(find src/declarations -type f -name index.js)
    do 
        canister=$(basename $(dirname "$f"))
        sed -i'.bak' "/^export const $canister/s/^/\/\//g" "$f"
        rm "$f.bak"
    done
cp .dfx/local/canisters/rabbithole/rabbithole.did.js .dfx/local/canisters/rabbithole/rabbithole.did.mjs

unset DFX_MOC_PATH