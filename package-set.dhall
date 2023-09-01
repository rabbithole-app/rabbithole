let upstream = https://github.com/dfinity/vessel-package-set/releases/download/mo-0.9.8-20230811/package-set.dhall sha256:162f8cfe5f4df8c65d3ef46b6ee2275235476b94290b92dff2626733676fd2db
let aviate-labs = https://github.com/aviate-labs/package-set/releases/download/v0.1.8/package-set.dhall sha256:9ab42c1f732299dc8c1f631d39ea6a2551414bf6efc8bbde4e11e36ebc6d7edd

let Package =
    { name : Text, version : Text, repo : Text, dependencies : List Text }

let additions =
  [
    { name = "base"
    , repo = "https://github.com/dfinity/motoko-base"
    , version = "moc-0.9.8"
    , dependencies = [] : List Text
    },
    -- { name = "stableBTree"
    -- , repo = "https://github.com/sardariuss/MotokoStableBTree"
    -- , version = "main"
    -- , dependencies = ["base", "matchers"]
    -- },
    { name = "hashmap_v8"
    , repo = "https://github.com/ZhenyaUsenko/motoko-hash-tree"
    , version = "main"
    , dependencies = [] : List Text
    },
    { name = "hashmap"
    , repo = "https://github.com/ZhenyaUsenko/motoko-hash-map"
    , version = "master"
    , dependencies = [] : List Text
    },
    { name = "cbor"
    , repo = "https://github.com/gekctek/motoko_cbor"
    , version = "v1.0.1"
    , dependencies = [ "xtended-numbers" ] : List Text
    },
    { name = "xtended-numbers"
    , version = "v1.0.2"
    , repo = "https://github.com/edjcase/motoko_numbers"
    , dependencies = [] : List Text
    },
    { name = "ic-certification"
    , repo = "https://github.com/nomeata/ic-certification"
    , version = "main"
    , dependencies = ["sha256", "sha224", "cbor"] : List Text
    },
    { name = "sha2"
    , repo = "https://github.com/research-ag/sha2.git"
    , version = "main"
    , dependencies = ["base"] : List Text
    },
    { name = "vector"
    , repo = "https://github.com/research-ag/vector.git"
    , version = "main"
    , dependencies = ["base"] : List Text
    }
  ] : List Package

in  upstream # aviate-labs # additions
