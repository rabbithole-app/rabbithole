import { AuthClient } from '@dfinity/auth-client';

export async function createAuthClient(): Promise<AuthClient> {
    return await AuthClient.create({
        idleOptions: {
            disableIdle: true,
            disableDefaultIdleCallback: true
        }
    });
}
