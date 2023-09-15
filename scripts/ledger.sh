#!/usr/bin/env bash

SRC_DIR="src/backend/ledger"

# Install ledger locally as documented in:
# https://internetcomputer.org/docs/current/developer-docs/integrations/ledger/ledger-local-setup

IC_VERSION=d353989b94e5862692ea2887637dcacace4e244c
mkdir -p $SRC_DIR
curl -kLo $SRC_DIR/ledger.wasm.gz https://download.dfinity.systems/ic/$IC_VERSION/canisters/ledger-canister.wasm.gz
curl -kLo $SRC_DIR/ledger.did https://raw.githubusercontent.com/dfinity/ic/$IC_VERSION/rs/rosetta-api/icp_ledger/ledger.did
mkdir -p .dfx/local/canisters/ledger
cp $SRC_DIR/ledger.wasm.gz .dfx/local/canisters/ledger/ledger.wasm.gz
dfx identity new --storage-mode=plaintext minter
dfx identity use minter
MINT_ACC=$(dfx identity get-principal)

dfx identity use default
ARCHIVE_CONTROLLER=$(dfx identity get-principal)
LEDGER_ACC=$(dfx identity get-principal)
ACCOUNT_ID=$(dfx ledger account-id)
dfx deploy ledger --specified-id ryjl3-tyaaa-aaaaa-aaaba-cai --argument "(variant {
    Init = record {
        send_whitelist = vec {
            principal \"$LEDGER_ACC\";
        };
        token_symbol = opt \"ICP\";
        transfer_fee = opt record { e8s = 10000 : nat64 };
        minting_account = \"$ACCOUNT_ID\";
        transaction_window = opt record {
            secs = 10 : nat64;
            nanos = 0 : nat32;
        };
        max_message_size_bytes = opt(2560000 : nat64);
        icrc1_minting_account = opt record {
            owner = principal \"$MINT_ACC\";
            subaccount = null;
        };
        archive_options = opt record {
            num_blocks_to_archive = 1000000 : nat64;
            max_transactions_per_response = null;
            trigger_threshold = 1000000 : nat64;
            max_message_size_bytes = null;
            cycles_for_archive_creation = null;
            node_max_memory_size_bytes = null;
            controller_id = principal \"$ARCHIVE_CONTROLLER\";
        };
        initial_values = vec {
            record {
                \"$ACCOUNT_ID\";
                record {
                    e8s = 10000000000 : nat64;
                };
            };
        };
        token_name = opt \"Internet Computer\";
    }
})" --yes -qq --upgrade-unchanged