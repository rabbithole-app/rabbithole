import packageJson from '../../package.json';

export const environment = {
    production: false,
    identityUrl: `http://qhbym-qaaaa-aaaaa-aaafq-cai.localhost:8080/#authorize`,
    appName: 'Rabbit Hole',
    envName: 'DEV',
    versions: {
        app: packageJson.version
    }
};
