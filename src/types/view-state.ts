/**
 * View state for persistence across sessions
 */
export interface ViewState {
  /** IDs of expanded nodes */
  expandedNodes: string[];

  /** Current sort mode (for Phase 2.2) */
  sortMode?: SortMode;

  /** Whether to show file nodes */
  showFiles: boolean;
}

/**
 * Sort modes for tree nodes
 */
export type SortMode =
  | "alpha-asc"
  | "alpha-desc"
  | "count-desc"
  | "count-asc"
  | "none";

/**
 * Default view state
 */
export const DEFAULT_VIEW_STATE: ViewState = {
  expandedNodes: [],
  sortMode: "none",
  showFiles: true,
};
