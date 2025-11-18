/**
 * View state for persistence across sessions
 */
export interface ViewState {
  /** IDs of expanded nodes */
  expandedNodes: string[];

  /** Runtime file sort mode override (overrides config default) */
  fileSortMode?: FileSortMode;

  /** Runtime per-level sort mode overrides (levelIndex → SortMode) */
  levelSortOverrides?: Record<number, SortMode>;

  /** Whether to show file nodes */
  showFiles: boolean;

  /** Scroll position in the tree view (for Phase 4.1) */
  scrollPosition?: number;
}

/**
 * Sort modes for tree nodes (tag/property groups)
 */
export type SortMode =
  | "alpha-asc"
  | "alpha-desc"
  | "count-desc"
  | "count-asc"
  | "none";

/**
 * Sort modes for file nodes
 */
export type FileSortMode =
  | "alpha-asc"
  | "alpha-desc"
  | "created-desc"
  | "created-asc"
  | "modified-desc"
  | "modified-asc"
  | "size-desc"
  | "size-asc"
  | "none";

/**
 * Default view state
 */
export const DEFAULT_VIEW_STATE: ViewState = {
  expandedNodes: [],
  fileSortMode: "alpha-asc",
  levelSortOverrides: {},
  showFiles: true,
  scrollPosition: 0,
};
