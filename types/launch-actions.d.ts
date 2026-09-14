/** Small launch actions authored in TypeScript, not executable HTML attributes. */
export interface LaunchActions {
    confirm(message: string): boolean;
    navigate(url: string): void;
}
export declare function bindLaunchActions(doc: Document, actions?: LaunchActions): void;
