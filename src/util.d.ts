export declare const hasVue: (source: string) => boolean;
type CustomFile = {
    filename: string;
    type?: string;
    query?: Record<string, string>;
};
export declare const parseSource: (source: string) => CustomFile;
export declare const isVue: (customFile: CustomFile) => boolean;
export declare const isTsx: (customFile: CustomFile) => boolean;
export declare const isJSX: (customFile: CustomFile) => boolean;
export declare const isJS: (customFile: CustomFile) => boolean;
export {};
