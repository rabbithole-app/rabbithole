import { FileListIconsConfig } from '@features/file-list/models';

export function getIconByExt(config: FileListIconsConfig, extension?: string): string {
    if (extension) {
        for (const [icon, extensions] of Object.entries(config.value)) {
            if (extensions.includes(extension)) {
                return `${config.namespace}:${icon}`;
            }
        }
    }

    return `${config.namespace}:unknown`;
}
