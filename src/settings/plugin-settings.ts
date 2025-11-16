import { ViewState, DEFAULT_VIEW_STATE } from "../types/view-state";

/**
 * Plugin settings schema
 */
export interface TagTreeSettings {
  /** Per-view state storage (keyed by view name) */
  viewStates: Record<string, ViewState>;
}

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: TagTreeSettings = {
  viewStates: {
    // Default view state
    default: { ...DEFAULT_VIEW_STATE },
  },
};
