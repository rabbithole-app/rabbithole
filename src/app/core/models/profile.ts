export type ProfileUpdate = {
    displayName: string;
    avatarUrl?: string;
};

export type Profile = ProfileUpdate & {
    username: string;
};
