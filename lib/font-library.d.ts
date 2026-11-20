import type { CallerIdentity } from './identity.js';
export interface LibraryFont {
    id: string;
    owner: string;
    family: string;
    variant: string;
    file: string;
    data: string;
    size: number;
    warnings: string[];
}
export declare const fontKey: (face: {
    family: string;
    variant?: string;
}) => string;
/** Validate a portable upload without storing it or changing other templates. */
export declare function prepareTemplateFont(input: {
    family: unknown;
    variant: unknown;
    data: unknown;
}): Omit<LibraryFont, 'owner'>;
export declare function templateFontFamilies(manifest: Record<string, any>): Set<string>;
/** Only canonical, validated font data is persisted; browser-supplied paths are never read. */
export declare class PptFontLibrary {
    private root;
    constructor(root: string);
    private owner;
    private dir;
    list(identity: CallerIdentity): LibraryFont[];
    prepare(input: {
        family: unknown;
        variant: unknown;
        data: unknown;
    }, identity: CallerIdentity): LibraryFont;
    put(entry: LibraryFont): void;
    adminList(identity: CallerIdentity): Omit<LibraryFont, 'data'>[];
    delete(owner: unknown, id: unknown, identity: CallerIdentity): void;
}
