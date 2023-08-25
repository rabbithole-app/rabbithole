import packageJson from '../../package.json';

export const environment = {
    production: true,
    identityUrl: 'https://identity.ic0.app/#authorize',
    appName: 'The Rabbit Hole',
    envName: 'PROD',
    registrationEnabled: true,
    // Point to icp-api for the mainnet. Leaving host undefined will work for localhost
    httpAgentHost: 'https://icp-api.io',
    versions: {
        app: packageJson.version
    }
};
