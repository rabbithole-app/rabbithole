import { Injectable, WritableSignal, signal } from '@angular/core';
import { createAuthClient } from '@core/utils';
import { AuthClient } from '@dfinity/auth-client';

@Injectable({
    providedIn: 'root'
})
export class ClientService {
    client: WritableSignal<AuthClient | null> = signal(null);
    isAuthenticated: WritableSignal<boolean> = signal(false);

    async createAuthClient() {
        const client = await createAuthClient();
        this.client.set(client);
        const isAuthenticated = await client.isAuthenticated();
        this.isAuthenticated.set(isAuthenticated);
    }
}
