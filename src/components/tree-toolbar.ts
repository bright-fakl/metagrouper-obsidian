import { setIcon } from "obsidian";
import { SortMode } from "../types/view-state";

/**
 * Toolbar configuration for callbacks
 */
export interface TreeToolbarCallbacks {
  onSortChange: (mode: SortMode) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onExpandToDepth: (depth: number) => void;
  onToggleFiles: () => void;
}

/**
 * TreeToolbar - Full-featured toolbar with expansion and sorting controls
 *
 * Phase 2.3: Implements collapse/expand controls, depth selector, and file visibility toggle
 */
export class TreeToolbar {
  private container: HTMLElement | null = null;
  private callbacks: TreeToolbarCallbacks;
  private currentSortMode: SortMode;
  private showFiles: boolean = true;

  // Sort mode labels for dropdown
  private readonly sortModeLabels: Record<SortMode, string> = {
    "alpha-asc": "A → Z",
    "alpha-desc": "Z → A",
    "count-desc": "Most files first",
    "count-asc": "Fewest files first",
    "none": "Default",
  };

  // Depth options for expansion
  private readonly depthOptions = [
    { value: 0, label: "Top level" },
    { value: 1, label: "1 level" },
    { value: 2, label: "2 levels" },
    { value: 3, label: "3 levels" },
    { value: -1, label: "All" },
  ];

  constructor(
    callbacks: TreeToolbarCallbacks,
    initialSortMode: SortMode = "alpha-asc",
    initialShowFiles: boolean = true
  ) {
    this.callbacks = callbacks;
    this.currentSortMode = initialSortMode;
    this.showFiles = initialShowFiles;
  }

  /**
   * Render the toolbar
   */
  render(container: HTMLElement): void {
    this.container = container;
    container.empty();

    const toolbar = container.createDiv("tag-tree-toolbar");

    // Row 1: Expansion controls
    const expansionRow = toolbar.createDiv("toolbar-row");
    this.renderExpansionControls(expansionRow);

    // Row 2: File visibility and sort controls
    const controlsRow = toolbar.createDiv("toolbar-row");
    this.renderFileVisibilityToggle(controlsRow);
    this.renderSortControl(controlsRow);
  }

  /**
   * Render expansion controls (collapse/expand buttons and depth selector)
   */
  private renderExpansionControls(row: HTMLElement): void {
    // Collapse All button
    const collapseBtn = row.createEl("button", {
      cls: "toolbar-button",
      attr: { "aria-label": "Collapse all nodes" },
    });
    const collapseIcon = collapseBtn.createSpan("toolbar-button-icon");
    setIcon(collapseIcon, "fold-vertical");
    collapseBtn.createSpan({ text: "Collapse All", cls: "toolbar-button-text" });
    collapseBtn.addEventListener("click", () => {
      this.callbacks.onCollapseAll();
    });

    // Expand All button
    const expandBtn = row.createEl("button", {
      cls: "toolbar-button",
      attr: { "aria-label": "Expand all nodes" },
    });
    const expandIcon = expandBtn.createSpan("toolbar-button-icon");
    setIcon(expandIcon, "unfold-vertical");
    expandBtn.createSpan({ text: "Expand All", cls: "toolbar-button-text" });
    expandBtn.addEventListener("click", () => {
      this.callbacks.onExpandAll();
    });

    // Depth selector section
    const depthSection = row.createDiv("toolbar-section");
    const depthLabel = depthSection.createSpan("toolbar-label");
    const depthIcon = depthLabel.createSpan("toolbar-icon");
    setIcon(depthIcon, "layers");
    depthLabel.createSpan({ text: "Depth:" });

    const depthDropdown = depthSection.createEl("select", {
      cls: "dropdown toolbar-dropdown",
      attr: { "aria-label": "Expand to depth" },
    });

    for (const option of this.depthOptions) {
      depthDropdown.createEl("option", {
        value: String(option.value),
        text: option.label,
      });
    }

    depthDropdown.addEventListener("change", () => {
      const depth = parseInt(depthDropdown.value);
      if (depth === -1) {
        // "All" selected - expand all nodes
        this.callbacks.onExpandAll();
      } else {
        this.callbacks.onExpandToDepth(depth);
      }
    });
  }

  /**
   * Render file visibility toggle
   */
  private renderFileVisibilityToggle(row: HTMLElement): void {
    const section = row.createDiv("toolbar-section");

    const label = section.createSpan("toolbar-label");
    const icon = label.createSpan("toolbar-icon");
    setIcon(icon, "file");
    label.createSpan({ text: "Show Files:" });

    // Toggle button (checkbox style)
    const toggle = section.createEl("button", {
      cls: this.showFiles ? "toolbar-toggle active" : "toolbar-toggle",
      attr: {
        "aria-label": "Toggle file visibility",
        "role": "switch",
        "aria-checked": String(this.showFiles)
      },
    });

    const toggleIcon = toggle.createSpan("toolbar-toggle-icon");
    setIcon(toggleIcon, this.showFiles ? "eye" : "eye-off");

    toggle.addEventListener("click", () => {
      this.showFiles = !this.showFiles;

      // Update button state
      if (this.showFiles) {
        toggle.addClass("active");
        toggle.setAttribute("aria-checked", "true");
      } else {
        toggle.removeClass("active");
        toggle.setAttribute("aria-checked", "false");
      }

      // Update icon
      toggleIcon.empty();
      setIcon(toggleIcon, this.showFiles ? "eye" : "eye-off");

      // Trigger callback
      this.callbacks.onToggleFiles();
    });
  }

  /**
   * Render the sort control dropdown
   */
  private renderSortControl(row: HTMLElement): void {
    const sortSection = row.createDiv("toolbar-section");

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

  /**
   * Set file visibility state (for state restoration)
   */
  setFileVisibility(show: boolean): void {
    if (this.showFiles === show) {
      return;
    }

    this.showFiles = show;

    // Update toggle button if toolbar is rendered
    if (this.container) {
      const toggle = this.container.querySelector(
        ".toolbar-toggle"
      ) as HTMLElement;
      if (toggle) {
        if (this.showFiles) {
          toggle.addClass("active");
          toggle.setAttribute("aria-checked", "true");
        } else {
          toggle.removeClass("active");
          toggle.setAttribute("aria-checked", "false");
        }

        const toggleIcon = toggle.querySelector(
          ".toolbar-toggle-icon"
        ) as HTMLElement;
        if (toggleIcon) {
          toggleIcon.empty();
          setIcon(toggleIcon, this.showFiles ? "eye" : "eye-off");
        }
      }
    }
  }
}
