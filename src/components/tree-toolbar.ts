import { setIcon } from "obsidian";
import { SortMode, FileSortMode } from "../types/view-state";
import { HierarchyConfig } from "../types/hierarchy-config";

/**
 * Toolbar configuration for callbacks
 */
export interface TreeToolbarCallbacks {
  onFileSortChange: (mode: FileSortMode) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onExpandToDepth: (depth: number) => void;
  onToggleFiles: () => void;
  onViewChange?: (viewName: string) => void;
}

/**
 * TreeToolbar - Full-featured toolbar with expansion and sorting controls
 *
 * Phase 2.3: Implements collapse/expand controls, depth selector, and file visibility toggle
 */
export class TreeToolbar {
  private container: HTMLElement | null = null;
  private callbacks: TreeToolbarCallbacks;
  private currentFileSortMode: FileSortMode;
  private showFiles: boolean = true;
  private savedViews: HierarchyConfig[];
  private currentViewName: string;

  // File sort mode labels for dropdown
  private readonly fileSortModeLabels: Record<FileSortMode, string> = {
    "alpha-asc": "A → Z",
    "alpha-desc": "Z → A",
    "created-desc": "Created ↓",
    "created-asc": "Created ↑",
    "modified-desc": "Modified ↓",
    "modified-asc": "Modified ↑",
    "size-desc": "Size ↓",
    "size-asc": "Size ↑",
    "none": "Unsorted",
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
    initialFileSortMode: FileSortMode = "alpha-asc",
    initialShowFiles: boolean = true,
    savedViews: HierarchyConfig[] = [],
    currentViewName: string = "All Tags"
  ) {
    this.callbacks = callbacks;
    this.currentFileSortMode = initialFileSortMode;
    this.showFiles = initialShowFiles;
    this.savedViews = savedViews;
    this.currentViewName = currentViewName;
  }

  /**
   * Render the toolbar
   */
  render(container: HTMLElement): void {
    this.container = container;
    container.empty();

    const toolbar = container.createDiv("tag-tree-toolbar");

    // Row 0: View switcher (at the very top)
    if (this.savedViews.length > 0 && this.callbacks.onViewChange) {
      const viewSwitcherRow = toolbar.createDiv("toolbar-row");
      this.renderViewSwitcher(viewSwitcherRow);
    }

    // Row 1: Expansion controls
    const expansionRow = toolbar.createDiv("toolbar-row");
    this.renderExpansionControls(expansionRow);

    // Row 2: File visibility and sort controls
    const controlsRow = toolbar.createDiv("toolbar-row");
    this.renderFileVisibilityToggle(controlsRow);
    this.renderSortControl(controlsRow);
  }

  /**
   * Render view switcher dropdown
   */
  private renderViewSwitcher(row: HTMLElement): void {
    const viewSection = row.createDiv("toolbar-section toolbar-view-section");

    // View label with icon
    const viewLabel = viewSection.createSpan("toolbar-label");
    const viewIcon = viewLabel.createSpan("toolbar-icon");
    setIcon(viewIcon, "layout-list");
    viewLabel.createSpan({ text: "View:" });

    // View dropdown
    const viewDropdown = viewSection.createEl("select", {
      cls: "dropdown toolbar-dropdown toolbar-view-dropdown",
    });

    // Add options for each saved view
    for (const view of this.savedViews) {
      const option = viewDropdown.createEl("option", {
        value: view.name,
        text: view.name,
      });

      if (view.name === this.currentViewName) {
        option.selected = true;
      }
    }

    // Handle view change
    viewDropdown.addEventListener("change", () => {
      const newViewName = viewDropdown.value;
      this.currentViewName = newViewName;
      if (this.callbacks.onViewChange) {
        this.callbacks.onViewChange(newViewName);
      }
    });
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

    // Create depth level buttons
    const depthButtonsContainer = depthSection.createDiv("toolbar-depth-buttons");

    for (const option of this.depthOptions) {
      const btn = depthButtonsContainer.createEl("button", {
        cls: "toolbar-depth-button",
        text: option.value === -1 ? "All" : String(option.value),
        attr: {
          "aria-label": `Expand to ${option.label}`,
          "title": `Expand to ${option.label}`,
        },
      });

      btn.addEventListener("click", () => {
        if (option.value === -1) {
          this.callbacks.onExpandAll();
        } else {
          this.callbacks.onExpandToDepth(option.value);
        }
      });
    }
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
   * Render the file sort control dropdown
   */
  private renderSortControl(row: HTMLElement): void {
    const sortSection = row.createDiv("toolbar-section");

    // Sort label with icon
    const sortLabel = sortSection.createSpan("toolbar-label");
    const sortIcon = sortLabel.createSpan("toolbar-icon");
    setIcon(sortIcon, "arrow-up-down");
    sortLabel.createSpan({ text: "Sort files:" });

    // Sort dropdown
    const sortDropdown = sortSection.createEl("select", {
      cls: "dropdown toolbar-dropdown",
    });

    // Add file sort mode options
    const fileSortModes: FileSortMode[] = [
      "alpha-asc",
      "alpha-desc",
      "created-desc",
      "created-asc",
      "modified-desc",
      "modified-asc",
      "size-desc",
      "size-asc",
    ];

    for (const mode of fileSortModes) {
      const option = sortDropdown.createEl("option", {
        value: mode,
        text: this.fileSortModeLabels[mode],
      });

      if (mode === this.currentFileSortMode) {
        option.selected = true;
      }
    }

    // Handle sort change
    sortDropdown.addEventListener("change", () => {
      const newMode = sortDropdown.value as FileSortMode;
      this.currentFileSortMode = newMode;
      this.callbacks.onFileSortChange(newMode);
    });
  }

  /**
   * Update the current file sort mode
   */
  setFileSortMode(mode: FileSortMode): void {
    if (this.currentFileSortMode === mode) {
      return;
    }

    this.currentFileSortMode = mode;

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
   * Get current file sort mode
   */
  getFileSortMode(): FileSortMode {
    return this.currentFileSortMode;
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

  /**
   * Update the saved views list (e.g., when views are added/removed in settings)
   */
  updateSavedViews(savedViews: HierarchyConfig[]): void {
    this.savedViews = savedViews;

    // Re-render if toolbar is already rendered
    if (this.container) {
      this.render(this.container);
    }
  }

  /**
   * Update the current view name
   */
  setCurrentViewName(viewName: string): void {
    if (this.currentViewName === viewName) {
      return;
    }

    this.currentViewName = viewName;

    // Update dropdown if toolbar is rendered
    if (this.container) {
      const dropdown = this.container.querySelector(
        ".toolbar-view-dropdown"
      ) as HTMLSelectElement;
      if (dropdown) {
        dropdown.value = viewName;
      }
    }
  }
}
