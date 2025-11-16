import { setIcon } from "obsidian";
import { SortMode } from "../types/view-state";

/**
 * Toolbar configuration for callbacks
 */
export interface TreeToolbarCallbacks {
  onSortChange: (mode: SortMode) => void;
}

/**
 * TreeToolbar - Minimal toolbar with sort controls
 *
 * Phase 2.2: Implements sorting controls
 * Future phases will add: collapse/expand all, expand to depth, view switcher
 */
export class TreeToolbar {
  private container: HTMLElement | null = null;
  private callbacks: TreeToolbarCallbacks;
  private currentSortMode: SortMode;

  // Sort mode labels for dropdown
  private readonly sortModeLabels: Record<SortMode, string> = {
    "alpha-asc": "A → Z",
    "alpha-desc": "Z → A",
    "count-desc": "Most files first",
    "count-asc": "Fewest files first",
    "none": "Default",
  };

  constructor(callbacks: TreeToolbarCallbacks, initialSortMode: SortMode = "alpha-asc") {
    this.callbacks = callbacks;
    this.currentSortMode = initialSortMode;
  }

  /**
   * Render the toolbar
   */
  render(container: HTMLElement): void {
    this.container = container;
    container.empty();

    const toolbar = container.createDiv("tag-tree-toolbar");

    // Sort control section
    this.renderSortControl(toolbar);
  }

  /**
   * Render the sort control dropdown
   */
  private renderSortControl(toolbar: HTMLElement): void {
    const sortSection = toolbar.createDiv("toolbar-section");

    // Sort label with icon
    const sortLabel = sortSection.createSpan("toolbar-label");
    const sortIcon = sortLabel.createSpan("toolbar-icon");
    setIcon(sortIcon, "arrow-up-down");
    sortLabel.createSpan({ text: "Sort:" });

    // Sort dropdown
    const sortDropdown = sortSection.createEl("select", {
      cls: "dropdown toolbar-dropdown",
    });

    // Add options
    const sortModes: SortMode[] = [
      "alpha-asc",
      "alpha-desc",
      "count-desc",
      "count-asc",
    ];

    for (const mode of sortModes) {
      const option = sortDropdown.createEl("option", {
        value: mode,
        text: this.sortModeLabels[mode],
      });

      if (mode === this.currentSortMode) {
        option.selected = true;
      }
    }

    // Handle sort change
    sortDropdown.addEventListener("change", () => {
      const newMode = sortDropdown.value as SortMode;
      this.currentSortMode = newMode;
      this.callbacks.onSortChange(newMode);
    });
  }

  /**
   * Update the current sort mode
   */
  setSortMode(mode: SortMode): void {
    if (this.currentSortMode === mode) {
      return;
    }

    this.currentSortMode = mode;

    // Update dropdown if toolbar is rendered
    if (this.container) {
      const dropdown = this.container.querySelector(
        ".toolbar-dropdown"
      ) as HTMLSelectElement;
      if (dropdown) {
        dropdown.value = mode;
      }
    }
  }

  /**
   * Get current sort mode
   */
  getSortMode(): SortMode {
    return this.currentSortMode;
  }
}
