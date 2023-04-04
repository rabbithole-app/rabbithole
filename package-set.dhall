let upstream = https://github.com/dfinity/vessel-package-set/releases/download/mo-0.8.4-20230311/package-set.dhall sha256:bf5cec8ba99cfa6abcdb793a4aeaea9f4c913a4bd97af0a556bd6e81aaf75cd4
let aviate-labs = https://github.com/aviate-labs/package-set/releases/download/v0.1.8/package-set.dhall sha256:9ab42c1f732299dc8c1f631d39ea6a2551414bf6efc8bbde4e11e36ebc6d7edd

let Package =
    { name : Text, version : Text, repo : Text, dependencies : List Text }

let additions =
  [
    { name = "base"
    , repo = "https://github.com/dfinity/motoko-base"
    , version = "moc-0.8.6"
    , dependencies = [] : List Text
    },
  ] : List Package

in  upstream # aviate-labs # additions
