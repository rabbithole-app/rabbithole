#!/usr/bin/env bash

SRC_DIR="src/backend/internet_identity"
IC_VERSION=release-2023-09-22
mkdir -p $SRC_DIR
curl -skLo $SRC_DIR/internet_identity.wasm.gz https://github.com/dfinity/internet-identity/releases/download/$IC_VERSION/internet_identity_dev.wasm.gz
curl -skLo $SRC_DIR/internet_identity.did https://github.com/dfinity/internet-identity/releases/download/$IC_VERSION/internet_identity.did
dfx deploy internet_identity --specified-id rdmx6-jaaaa-aaaaa-aaadq-cai --no-wallet --quiet