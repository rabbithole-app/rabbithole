export * from './overlay';

export type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
    [Property in Key]-?: Type[Property];
};

export type CanisterResult<T, E> = { ok: T } | { err: E };
