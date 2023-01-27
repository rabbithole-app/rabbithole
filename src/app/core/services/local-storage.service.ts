import { Injectable } from '@angular/core';

const APP_PREFIX = 'RH-';

@Injectable()
export class LocalStorageService {
    set(key: string, value: any) {
        localStorage.setItem(`${APP_PREFIX}${key}`, JSON.stringify(value));
    }

    get(key: string) {
        return JSON.parse(localStorage.getItem(`${APP_PREFIX}${key}`) || '{}');
    }

    remove(key: string) {
        localStorage.removeItem(`${APP_PREFIX}${key}`);
    }
}
