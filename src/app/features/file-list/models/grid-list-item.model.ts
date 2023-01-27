import { enumToValues } from '@core/utils';

export enum HostItemState {
    Add = 'add',
    Remove = 'remove'
}
const hostItemAnimationStates = enumToValues(HostItemState);
export type HostItemAnimationState = (typeof hostItemAnimationStates)[number];

export enum StatusIconState {
    Loading,
    Success,
    Failure
}
const statusIconAnimationStates = enumToValues(StatusIconState);
export type StatusIconAnimationState = (typeof statusIconAnimationStates)[number];
