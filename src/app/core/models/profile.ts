import { Principal } from '@dfinity/principal';

export type ProfileUpdate = {
    displayName: string;
    avatarUrl?: string;
};

export type Profile = ProfileUpdate & {
    username: string;
};

export type ProfileItem = Profile & {
    principal: string;
};
