import { BreakpointObserver } from '@angular/cdk/layout';
import { InjectionToken, Provider } from '@angular/core';
import { RxState } from '@rx-angular/state';
import { combineLatest, distinctUntilChanged, first, map } from 'rxjs';
import { SettingsState, SETTINGS_RX_STATE } from './settings';

export interface SidebarState {
    isFull: boolean;
    initAnimationDisabled: boolean;
}

export const SIDEBAR_RX_STATE = new InjectionToken<RxState<SidebarState>>('SIDEBAR_RX_STATE');

export function sidebarStateFactory(settingsState: RxState<SettingsState>, breakpointObserver: BreakpointObserver) {
    const state = new RxState<SidebarState>();
    state.connect(
        'isFull',
        combineLatest([
            breakpointObserver
                .observe(['(min-width: 960px)', '(max-width: 959.98px)'])
                .pipe(map(({ breakpoints: { '(min-width: 960px)': isFull } }) => isFull)),
            settingsState.select('sidebarMode').pipe(map(mode => mode === 'full'))
        ]).pipe(
            map(([isFull, isFullFromSettings]) => (isFull ? isFullFromSettings : false)),
            distinctUntilChanged()
        )
    );
    state.connect(
        'initAnimationDisabled',
        state.select('isFull').pipe(
            first(),
            map(v => !v)
        )
    );
    return state;
}

export const sidebarStateProvider: Provider = {
    provide: SIDEBAR_RX_STATE,
    useFactory: sidebarStateFactory,
    deps: [SETTINGS_RX_STATE, BreakpointObserver]
};
