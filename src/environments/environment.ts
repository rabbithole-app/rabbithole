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
    identityUrl: 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:8080/',
    appName: 'The Rabbit Hole',
    envName: 'DEV',
    registrationEnabled: true,
    versions: {
        app: packageJson.version
    }
};
