import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken, RendererFactory2 } from '@angular/core';
import { TranslocoService } from '@ngneat/transloco';
import { RxState } from '@rx-angular/state';
import { filter, pairwise, startWith } from 'rxjs/operators';

import { LocalStorageService } from '@core/services';

export const SETTINGS_LS_KEY = 'SETTINGS';

export type Language = 'en' | 'de' | 'ru';
export type Theme = 'light-theme' | 'dark-theme';
export type SidebarMode = 'full' | 'compact';

export interface SettingsState {
    language: Language;
    theme: Theme;
    sidebarMode: SidebarMode;
    expertMode: boolean;
}

export const initialSettingsState: SettingsState = {
    language: 'en',
    theme: 'light-theme',
    sidebarMode: 'full',
    expertMode: false
};

export function settingsStateFactory() {
    const state = new RxState<SettingsState>();
    const rendererFactory = inject(RendererFactory2);
    const renderer = rendererFactory.createRenderer(null, null);
    const document = inject(DOCUMENT);
    const localStorageService = inject(LocalStorageService);
    const settings = localStorageService.get(SETTINGS_LS_KEY);
    const translocoService = inject(TranslocoService);
    state.set({ ...initialSettingsState, ...settings });

    state
        .select('theme')
        .pipe(startWith('light-theme'), pairwise())
        .subscribe(([previousTheme, theme]) => {
            if (previousTheme !== theme) {
                renderer.removeClass(document.body, previousTheme);
            }

            renderer.addClass(document.body, theme);
        });
    state
        .select('language')
        .pipe(filter(lang => lang !== translocoService.getActiveLang()))
        .subscribe(lang => translocoService.setActiveLang(lang));
    state.select().subscribe(state => localStorageService.set(SETTINGS_LS_KEY, state));

    return state;
}

export const SETTINGS_RX_STATE = new InjectionToken<RxState<SettingsState>>('SETTINGS_RX_STATE', {
    providedIn: 'root',
    factory: settingsStateFactory
});
