import { AnimationEvent, trigger } from '@angular/animations';
import { Component, OnInit, ChangeDetectionStrategy, HostBinding, ElementRef, Renderer2, OnDestroy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@ngneat/transloco';
import { PushPipe } from '@rx-angular/template/push';
import { RxIf } from '@rx-angular/template/if';
import { AsyncSubject, Observable, shareReplay, timer } from 'rxjs';
import { switchMap, take, tap } from 'rxjs/operators';

import { SIDEBAR_TEXT_ANIMATION } from '@core/animations';
import { SETTINGS_RX_STATE } from '@core/stores';
import { AuthService } from '@core/services';
import { LogoComponent } from '../logo/logo.component';
import { SidebarService } from '../../services/sidebar.service';
import { addFASvgIcons } from '@core/utils';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PushPipe, RxIf, LogoComponent, RouterModule, MatTooltipModule, TranslocoModule, MatIconModule, MatButtonModule],
    standalone: true,
    animations: [trigger('textAnimation', SIDEBAR_TEXT_ANIMATION)]
})
export class SidebarComponent implements OnInit, OnDestroy {
    private destroyed: AsyncSubject<void> = new AsyncSubject<void>();
    private element = inject(ElementRef);
    private renderer = inject(Renderer2);

    settingsState = inject(SETTINGS_RX_STATE);
    sidebarService = inject(SidebarService);
    isFull$: Observable<boolean> = this.sidebarService.select('isFull').pipe(shareReplay(1));
    authService = inject(AuthService);

    constructor() {
        addFASvgIcons(['arrow-right-from-bracket'], 'far');
    }

    @HostBinding('class.compact')
    get isCompact() {
        return !this.sidebarService.get('isFull');
    }

    ngOnInit(): void {
        // убираем анимацию при загрузке страницы с компактным sidebar
        this.sidebarService
            .select('initAnimationDisabled')
            .pipe(
                take(1),
                tap(() => this.renderer.addClass(this.element.nativeElement, 'animation-disabled')),
                switchMap(() => timer(500)),
                tap(() => this.renderer.removeClass(this.element.nativeElement, 'animation-disabled'))
            )
            .subscribe();
    }

    handleTheme(event: MatSlideToggleChange) {
        this.settingsState.set('theme', () => (event.checked ? 'dark-theme' : 'light-theme'));
    }

    ngOnDestroy(): void {
        this.destroyed.next();
        this.destroyed.complete();
    }

    captureStartEvent(event: AnimationEvent) {
        this.sidebarService.animationStart(event);
    }

    captureDoneEvent() {
        this.sidebarService.animationDone();
    }
}
