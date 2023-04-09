import { FileListIconsConfig } from '@features/file-list/models';

export function getIconByFilename(config: FileListIconsConfig, filename?: string): string {
    const extension = filename?.split('.').pop();
    if (extension) {
        for (const [icon, extensions] of Object.entries(config.value)) {
            if (extensions.includes(extension)) {
                return `${config.namespace}:${icon}`;
            }
        }
    }

    return `${config.namespace}:unknown`;
}
