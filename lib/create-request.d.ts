/** Read a caller-selected local JSON request without passing its text through the model. */
export declare function readCreateRequest(wrapper: Record<string, unknown>, cwd: string, signal?: AbortSignal): Promise<{
    input: Record<string, unknown>;
    receipt: {
        sha256: string;
        bytes: number;
    };
}>;
