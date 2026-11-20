import type { DeckEngine } from './types.js';
type RecordValue = Record<string, any>;
interface GenerationContext {
    scope: string;
    outputDir: string;
    route: {
        provider: string;
        model: string;
    } | null;
    signal?: AbortSignal;
}
interface GenerationOptions {
    root?: string;
    loadEngine: () => Promise<DeckEngine>;
    maxSlides: number;
}
export declare class PptGenerationService {
    readonly root: string;
    private readonly options;
    constructor(options: GenerationOptions);
    private namespace;
    private file;
    private read;
    private event;
    private responses;
    private locked;
    private view;
    private recover;
    execute(args: RecordValue, context: GenerationContext): Promise<RecordValue>;
}
export {};
