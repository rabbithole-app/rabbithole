import packageJson from '../../package.json';

export const environment = {
    production: true,
    identityUrl: 'https://identity.ic0.app/#authorize',
    appName: 'Rabbit Hole',
    envName: 'PROD',
    registrationEnabled: true,
    versions: {
        app: packageJson.version
    }
};
