import type { GameStorage } from './storage.js';
export interface StoragePanelActions {
    save: () => Promise<boolean>;
    export: () => Promise<void>;
}
export declare function openStoragePanel(storage: GameStorage, actions: StoragePanelActions): void;
