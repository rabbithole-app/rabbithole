const path = require('path');
const webpack = require('webpack');
const zlib = require('zlib');
const CompressionPlugin = require('compression-webpack-plugin');

let localCanisters, prodCanisters, canisters;

const network = process.env.DFX_NETWORK || (process.env.NODE_ENV === 'production' ? 'ic' : 'local');

function initCanisterIds() {
    try {
        localCanisters = require(path.resolve('.dfx', 'local', 'canister_ids.json'));
    } catch (error) {
        console.log('No local canister_ids.json found. Continuing production');
    }

    try {
        prodCanisters = require(path.resolve('canister_ids.json'));
    } catch (error) {
        console.log('No production canister_ids.json found. Continuing with local');
    }

    canisters = network === 'local' ? localCanisters : prodCanisters;

    for (const canister in canisters) {
        if (canisters.hasOwnProperty(canister)) {
            process.env['CANISTER_ID_' + canister.toUpperCase()] = canisters[canister][network];
        }
    }
}

initCanisterIds();

const env = {
    DFX_NETWORK: network,
    CANISTER_ID_RABBITHOLE: canisters['rabbithole'],
    CANISTER_ID_VETKD_SYSTEM_API: canisters['vetkd_system_api']
};

module.exports = {
    node: { global: true },
    resolve: {
        fallback: {
            assert: require.resolve('assert'),
            stream: require.resolve('stream-browserify')
        }
    },
    plugins: [
        new webpack.EnvironmentPlugin(env),
        new webpack.ProvidePlugin({
            Buffer: [require.resolve('buffer'), 'Buffer'],
            process: require.resolve('process/browser')
        }),
        new CompressionPlugin({
            filename: '[path][base].gz',
            algorithm: 'gzip',
            test: /\.(js|css|html|svg|wasm)$/,
            threshold: 10240,
            minRatio: 0.8
        }),
        new CompressionPlugin({
            filename: '[path][base].br',
            algorithm: 'brotliCompress',
            test: /\.(js|css|html|svg|wasm)$/,
            compressionOptions: {
                params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: 11
                }
            },
            threshold: 10240,
            minRatio: 0.8
        })
    ]
};
