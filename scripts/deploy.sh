#!/bin/bash

export DFX_MOC_PATH="$(vessel bin)/moc"
DEV_PRINCIPAL=$(dfx identity get-principal)

dfx stop
dfx start --background --clean

# dfx extension install nns
# dfx nns install

# Let's create NNS canisters manually so that application canisters can spend cycles
source ./scripts/ledger.sh
dfx canister create rabbithole
source ./scripts/cmc.sh
source ./scripts/ii.sh

dfx deploy vetkd_system_api  -qq
dfx deploy rabbithole -qq
dfx deploy journal --argument "principal \"$DEV_PRINCIPAL\"" -qq
dfx deploy storage --argument "principal \"$DEV_PRINCIPAL\"" -qq
dfx deploy rabbithole_frontend

for f in $(find src/declarations -type f -name index.js)
    do 
        canister=$(basename $(dirname "$f"))
        sed -i'.bak' "/^export const $canister/s/^/\/\//g" "$f"
        rm "$f.bak"
    done
cp .dfx/local/canisters/rabbithole/service.did.js .dfx/local/canisters/rabbithole/service.did.mjs

unset DFX_MOC_PATH