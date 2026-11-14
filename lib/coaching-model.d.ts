export interface ModelRoute {
    provider: string;
    model: string;
}
export interface CoachingModel {
    routes(signal?: AbortSignal, owner?: string): Promise<Array<ModelRoute & {
        label: string;
    }>>;
    generate(route: ModelRoute, system: string, input: string, signal: AbortSignal, owner?: string): Promise<string>;
}
export declare function nativeCoachingModel(llm: any): CoachingModel;
