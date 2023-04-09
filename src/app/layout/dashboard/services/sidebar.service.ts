import { AnimationBuilder, AnimationEvent } from '@angular/animations';
import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Injectable } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { RxState } from '@rx-angular/state';
import { combineLatest, distinctUntilChanged, first, map } from 'rxjs';
import { get } from 'lodash';

import { SETTINGS_RX_STATE } from '@core/stores';

interface TransitionAnimationPlayer extends AnimationEvent {
    destroy: Function;
}

export interface State {
    isFull: boolean;
    initAnimationDisabled: boolean;
    activePlayers: TransitionAnimationPlayer[];
    drawer: MatDrawer;
}

@Injectable()
export class SidebarService extends RxState<State> {
    private settingsState = inject(SETTINGS_RX_STATE);
    private breakpointObserver = inject(BreakpointObserver);
    private animationBuilder = inject(AnimationBuilder);

    constructor() {
        super();
        console.log('SidebarService');
        this.set({ activePlayers: [] });
        this.connect(
            'isFull',
            combineLatest([
                this.breakpointObserver
                    .observe(['(min-width: 960px)', '(max-width: 959.98px)'])
                    .pipe(map(({ breakpoints: { '(min-width: 960px)': isFull } }) => isFull)),
                this.settingsState.select('sidebarMode').pipe(map(mode => mode === 'full'))
            ]).pipe(
                map(([isFull, isFullFromSettings]) => (isFull ? isFullFromSettings : false)),
                distinctUntilChanged()
            )
        );
        this.connect(
            'initAnimationDisabled',
            this.select('isFull').pipe(
                first(),
                map(v => !v)
            )
        );
    }

    animationStart(event: AnimationEvent) {
        const players = (get(this.animationBuilder, '_renderer.engine.players') as unknown as TransitionAnimationPlayer[]).filter(
            p => p.triggerName === event.triggerName
        );
        this.get('activePlayers').forEach(player => player.destroy());
        this.set({ activePlayers: players });
    }

    animationDone(event: AnimationEvent) {
        this.set({ activePlayers: [] });
    }

    setDrawer(drawer: MatDrawer) {
        this.set({ drawer });
    }

    toggleDrawer() {
        const drawer = this.get('drawer');
        drawer.toggle();
    }
}
