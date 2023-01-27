export type Enum = { [s: number]: string };

export function isEnumKey<T extends Enum>(enumSrc: T, key: unknown): key is keyof T {
    return Number.isInteger(enumSrc[key as keyof T]);
}

export function isEnumValue<T extends Enum>(enumSrc: T, value: unknown): value is T[keyof T] {
    return Number.isInteger(enumSrc[enumSrc[value as keyof T] as any as keyof T]);
}

export function enumToKeys<T extends Enum>(enumSrc: T): (keyof T)[] {
    return Object.keys(enumSrc).filter((key: keyof T | any) => isEnumKey(enumSrc, key)) as (keyof T)[];
}

export function enumToValues<T extends Enum>(enumSrc: T): T[keyof T][] {
    return enumToKeys(enumSrc).map((key: keyof T) => enumSrc[key]);
}

export function enumValueToKey<T extends Enum>(enumSrc: T, value: T[keyof T]): keyof T | undefined {
    return (enumSrc as any)[value];
}

export function enumToEntries<T extends Enum>(enumSrc: T): [keyof T, T[keyof T]][] {
    return enumToValues(enumSrc).map((value: T[keyof T]) => [enumValueToKey(enumSrc, value) as keyof T, value]);
}
