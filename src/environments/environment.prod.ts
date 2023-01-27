import packageJson from '../../package.json';

export const environment = {
    production: true,
    identityUrl: 'https://identity.ic0.app/#authorize',
    appName: 'Rabbit Hole',
    envName: 'PROD',
    versions: {
        app: packageJson.version
    }
};
