import { ViewState, DEFAULT_VIEW_STATE } from "../types/view-state";
import {
  HierarchyConfig,
  EXAMPLE_HIERARCHY_CONFIGS,
} from "../types/hierarchy-config";

/**
 * Plugin settings schema
 */
export interface TagTreeSettings {
  /** All saved view configurations */
  savedViews: HierarchyConfig[];

  /** Name of the default view to load for new instances */
  defaultViewName: string;

  /** Per-view UI state storage (keyed by view name) */
  viewStates: Record<string, ViewState>;
}

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: TagTreeSettings = {
  // Initialize with example configurations
  savedViews: [...EXAMPLE_HIERARCHY_CONFIGS],

  // Default to "All Tags" view
  defaultViewName: "All Tags",

  viewStates: {
    // Default view state for "All Tags"
    "All Tags": { ...DEFAULT_VIEW_STATE },
  },
};
