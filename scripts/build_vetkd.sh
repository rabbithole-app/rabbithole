#!/bin/bash

SRC_DIR="src/backend/vetkd_system_api"
cargo build --release --target wasm32-unknown-unknown --manifest-path "$SRC_DIR/Cargo.toml"
ic-wasm target/wasm32-unknown-unknown/release/vetkd_system_api.wasm -o "$SRC_DIR/vetkd_system_api.wasm" shrink
ic-wasm "$SRC_DIR/vetkd_system_api.wasm" -o "$SRC_DIR/vetkd_system_api.wasm" metadata candid:service -f "$SRC_DIR//vetkd_system_api.did" -v public
ic-wasm "$SRC_DIR/vetkd_system_api.wasm" -o "$SRC_DIR/vetkd_system_api.wasm" metadata supported_certificate_versions -d "1,2" -v public
gzip --no-name --force "$SRC_DIR/vetkd_system_api.wasm"