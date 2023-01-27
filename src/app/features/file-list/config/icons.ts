import { FileListIconsConfig } from '@features/file-list/models';

export const COLORS_ICONS_CONFIG: FileListIconsConfig = {
    namespace: 'filetype-colors',
    value: {
        ai: ['ai'],
        android: [],
        apk: ['apk'],
        css: ['css', 'scss', 'sass', 'less'],
        disc: ['dmg', 'rom', 'mdf', 'mg', 'dsk', 'nrg', 'hdd'],
        doc: ['doc', 'docx'],
        excel: [],
        font: ['woff', 'woff2', 'eof'],
        iso: ['iso'],
        javascript: ['ts', 'tsx'],
        jpg: ['jpg', 'jpeg', 'png', 'gif'],
        js: ['js', 'jsx'],
        mail: ['eml', 'emlx'],
        mp3: ['mp3'],
        mp4: ['mp4'],
        music: [],
        pdf: ['pdf'],
        php: ['php'],
        play: [],
        powerpoint: [],
        ppt: ['ppt'],
        psd: ['psd'],
        record: ['record'],
        sql: ['sql', 'db'],
        svg: ['svg'],
        text: ['md'],
        ttf: ['ttf'],
        txt: ['txt'],
        vcf: ['vcf'],
        vector: ['cdr', 'eps', 'sketch'],
        video: ['mkv', 'avi', 'webm', 'wmv'],
        word: [],
        xls: ['xls', 'xlsx'],
        zip: ['zip', 'rar', 'ice', 'gz', 'gzip', 'tar', 'tar.gz', 'ace'],
        unknown: [],
        blank: []
    },
    path: 'assets/icons/file-types/colors/'
};

export const GRAY_ICONS_CONFIG: FileListIconsConfig = {
    namespace: 'filetype-grey',
    value: {
        font: ['woff', 'woff2', 'eof', 'eot', 'otf', 'ttf'],
        archive: ['zip', 'rar', 'ice', 'gz', 'gzip', 'tar', 'tar.gz', 'ace'],
        vector: ['ai', 'cdr', 'eps', 'bmml', 'indd', 'svg'],
        text: ['doc', 'docx', 'dot', 'dotx', 'md', 'rtf'],
        code: ['css', 'js', 'json', 'less', 'scss'],
        sketch: ['sketch'],
        image: ['psd', 'tiff', 'gif', 'ico', 'jpg', 'jpeg', 'png'],
        html: ['html'],
        video: ['mkv', 'avi', 'webm', 'wmv', 'mov', 'mpeg', 'mp3', 'mp4'],
        xls: ['xls', 'xlsx'],
        pdf: ['pdf'],
        dmg: ['dmg'],
        unknown: [],
        blank: []
    },
    path: 'assets/icons/file-types/grey/'
};

export const BORDERS_ICONS_CONFIG: FileListIconsConfig = {
    ...GRAY_ICONS_CONFIG,
    namespace: 'filetype-borders',
    path: 'assets/icons/file-types/borders/'
};
