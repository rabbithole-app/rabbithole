# Deploying Cycles Minting Canister Locally

To create canisters using the CMC, you must have appropriate rights for the caller. These rights are set using the Governance canister. In order to avoid installing unnecessary canisters, we need to make the `set_authorized_subnetwork_list` method available for calling not only by the governance canister, for this we need to comment out [this line](https://github.com/dfinity/ic/blob/master/rs/nns/cmc/src/main.rs#L328) and change [`cmc.did`](https://github.com/dfinity/ic/blob/master/rs/nns/cmc/cmc.did), add the public method `set_authorized_subnetwork_list` to it.

## How to build a custom cmc.wasm?

Clone the `dfinity/ic` repository and go to the `rs/nns/cmc` directory:
```sh
git clone https://github.com/dfinity/ic
cd ic/rs/nns/cmc
sed -i'.bak' '/panic!("Only the governance canister can set authorized subnetwork lists.");/ s/^/\/\//g' src/main.rs
rm src/main.rs.bak
cargo build --release --target wasm32-unknown-unknown
ic-wasm ../../../target/wasm32-unknown-unknown/release/cycles-minting-canister.wasm -o cmc-custom.wasm shrink
```
Copy `cmc-custom.wasm` to the project. Next, add a new method to `cmc.did`:
```
+type SetAuthorizedSubnetworkListArgs = record {
+    who : opt principal;
+    subnets : vec principal;
+};

service : (opt CyclesCanisterInitPayload) -> {
  // ...

+  set_authorized_subnetwork_list: (SetAuthorizedSubnetworkListArgs) -> ();
}
```

## Setting rights
Once the CMC canister is deployed, we will be able to call this method and assign rights to specific principals. To do this, in addition to the Principal of the caller, we need to find out `subnetId`, I wrote [a small script](../../../scripts/subnet-id.mjs). Now, knowing who should have the right to create canisters and `subnetId`, we can execute:

```sh
RABBITHOLE=$(dfx canister id rabbithole)
SUBNET_ID=$(node ./scripts/subnet-id.mjs)
dfx canister call cmc set_authorized_subnetwork_list "(record {
    who = opt principal \"$RABBITHOLE\";
    subnets = vec { principal \"$SUBNET_ID\" }
})"
```