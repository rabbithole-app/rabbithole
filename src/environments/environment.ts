import packageJson from '../../package.json';

type Environment = {
    production: boolean;
    identityUrl: string;
    appName: string;
    envName: 'DEV' | 'PROD';
    registrationEnabled: boolean;
    httpAgentHost?: string;
    versions: {
        app: string;
    };
};

export const environment: Environment = {
    production: false,
    identityUrl: 'http://qhbym-qaaaa-aaaaa-aaafq-cai.localhost:8080/#authorize',
    appName: 'The Rabbit Hole',
    envName: 'DEV',
    registrationEnabled: true,
    versions: {
        app: packageJson.version
    }
};
