import { animate, style, transition } from '@angular/animations';

const TRANSITION_TIMING_FUNCTION = 'cubic-bezier(0.16, 1, 0.3, 1)';
const TRANSITION_DURATION = 1000;
const TRANSITION_ENTER_DELAY = 0;
const TRANSITION_LEAVE_DELAY = 1000;

export const SIDEBAR_TEXT_ANIMATION = [
    transition(':enter', [style({ opacity: 0, width: 0 }), animate('{{duration}}ms {{delay}}ms {{timingFn}}', style({ opacity: 1, width: '*' }))], {
        params: { duration: TRANSITION_DURATION, timingFn: TRANSITION_TIMING_FUNCTION, delay: TRANSITION_ENTER_DELAY }
    }),
    transition(':leave', [style({ opacity: 1, width: '*' }), animate('{{duration}}ms {{delay}}ms {{timingFn}}', style({ opacity: 0, width: 0 }))], {
        params: { duration: TRANSITION_DURATION, timingFn: TRANSITION_TIMING_FUNCTION, delay: TRANSITION_LEAVE_DELAY }
    })
];
