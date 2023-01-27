let upstream = https://github.com/dfinity/vessel-package-set/releases/download/mo-0.8.3-20230224/package-set.dhall sha256:df71395fc48d1a0f41c0b49a0a6e0490d0b52641a86a9d51651bf2622e87fbff
let aviate-labs = https://github.com/aviate-labs/package-set/releases/download/v0.1.8/package-set.dhall sha256:9ab42c1f732299dc8c1f631d39ea6a2551414bf6efc8bbde4e11e36ebc6d7edd

let Package =
    { name : Text, version : Text, repo : Text, dependencies : List Text }

let additions =
  [
    { name = "base"
    , repo = "https://github.com/dfinity/motoko-base"
    , version = "0d42146536771a60933786d8387b7c4ea4a1614b"
    , dependencies = [] : List Text
    },
  ] : List Package

in  upstream # aviate-labs # additions
