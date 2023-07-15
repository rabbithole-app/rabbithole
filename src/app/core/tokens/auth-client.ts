import { InjectionToken } from '@angular/core';
import { AuthClient } from '@dfinity/auth-client';

export const AUTH_CLIENT_INIT_STATE = new InjectionToken<{ client: AuthClient; isAuthenticated: boolean }>('AUTH_CLIENT_INIT_STATE');
