import { setIcon, DropdownComponent, ButtonComponent, ToggleComponent } from "obsidian";
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
  private isCollapsed: boolean = false;

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

    // Create collapsible toolbar container
    const details = container.createEl("details", {
      cls: "tag-tree-toolbar"
    });

    if (!this.isCollapsed) {
      details.setAttribute("open", "");
    }

    // Collapsible header with view name
    const summary = details.createEl("summary", { cls: "tag-tree-toolbar-header" });

    // View name with icon
    const viewTitle = summary.createDiv({ cls: "tag-tree-toolbar-title" });
    const viewIcon = viewTitle.createSpan();
    setIcon(viewIcon, "layout-list");
    viewTitle.createSpan({ text: this.currentViewName, cls: "tag-tree-toolbar-view-name" });

    // View switcher (if multiple views exist)
    if (this.savedViews.length > 1 && this.callbacks.onViewChange) {
      const viewSwitcher = summary.createDiv({ cls: "tag-tree-toolbar-view-switcher" });
      this.renderViewSwitcher(viewSwitcher);
    }

    // Track collapse state
    details.addEventListener("toggle", () => {
      this.isCollapsed = !details.hasAttribute("open");
    });

    // Toolbar content
    const toolbar = details.createDiv("tag-tree-toolbar-content");

    // Row 1: Expansion controls
    const expansionRow = toolbar.createDiv("tag-tree-toolbar-row");
    this.renderExpansionControls(expansionRow);

    // Row 2: File visibility and sort controls
    const controlsRow = toolbar.createDiv("tag-tree-toolbar-row");
    this.renderFileVisibilityToggle(controlsRow);
    this.renderSortControl(controlsRow);
  }

  /**
   * Render view switcher dropdown
   */
  private renderViewSwitcher(container: HTMLElement): void {
    // View dropdown using DropdownComponent (compact, no label)
    new DropdownComponent(container)
      .addOptions(
        Object.fromEntries(
          this.savedViews.map((view) => [view.name, view.name])
        )
      )
      .setValue(this.currentViewName)
      .onChange((value) => {
        this.currentViewName = value;
        if (this.callbacks.onViewChange) {
          this.callbacks.onViewChange(value);
        }
      });
  }

  /**
   * Render expansion controls (collapse/expand buttons and depth selector)
   */
  private renderExpansionControls(row: HTMLElement): void {
    // Button group
    const buttonGroup = row.createDiv({ cls: "tag-tree-toolbar-group" });

    // Collapse All button
    new ButtonComponent(buttonGroup)
      .setButtonText("Collapse")
      .setIcon("fold-vertical")
      .setTooltip("Collapse all nodes")
      .onClick(() => {
        this.callbacks.onCollapseAll();
      });

    // Expand All button
    new ButtonComponent(buttonGroup)
      .setButtonText("Expand")
      .setIcon("unfold-vertical")
      .setTooltip("Expand all nodes")
      .onClick(() => {
        this.callbacks.onExpandAll();
      });

    // Depth selector group
    const depthGroup = row.createDiv({ cls: "tag-tree-toolbar-group" });

    // Depth selector label
    const depthLabel = depthGroup.createSpan({ cls: "tag-tree-toolbar-label" });
    const depthIcon = depthLabel.createSpan({ cls: "tag-tree-toolbar-icon" });
    setIcon(depthIcon, "layers");
    depthLabel.createSpan({ text: "Depth:" });

    // Create depth level buttons using clickable-icon
    const depthButtons = depthGroup.createDiv({ cls: "tag-tree-toolbar-buttons" });
    for (const option of this.depthOptions) {
      const btn = depthButtons.createEl("button", {
        cls: "clickable-icon",
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
    const group = row.createDiv({ cls: "tag-tree-toolbar-group" });

    // Label
    const label = group.createSpan({ cls: "tag-tree-toolbar-label" });
    const icon = label.createSpan({ cls: "tag-tree-toolbar-icon" });
    setIcon(icon, "file");
    label.createSpan({ text: "Show Files:" });

    // Toggle button using clickable-icon
    const toggle = group.createEl("button", {
      cls: this.showFiles ? "clickable-icon is-active" : "clickable-icon",
      attr: {
        "aria-label": "Toggle file visibility",
        "role": "switch",
        "aria-checked": String(this.showFiles)
      },
    });

    setIcon(toggle, this.showFiles ? "eye" : "eye-off");

    toggle.addEventListener("click", () => {
      this.showFiles = !this.showFiles;

      // Update button state
      if (this.showFiles) {
        toggle.addClass("is-active");
        toggle.setAttribute("aria-checked", "true");
      } else {
        toggle.removeClass("is-active");
        toggle.setAttribute("aria-checked", "false");
      }

      // Update icon
      toggle.empty();
      setIcon(toggle, this.showFiles ? "eye" : "eye-off");

      // Trigger callback
      this.callbacks.onToggleFiles();
    });
  }

  /**
   * Render the file sort control dropdown
   */
  private renderSortControl(row: HTMLElement): void {
    const group = row.createDiv({ cls: "tag-tree-toolbar-group" });

    // Sort label with icon
    const sortLabel = group.createSpan({ cls: "tag-tree-toolbar-label" });
    const sortIcon = sortLabel.createSpan({ cls: "tag-tree-toolbar-icon" });
    setIcon(sortIcon, "arrow-up-down");
    sortLabel.createSpan({ text: "Sort files:" });

    // Sort dropdown using DropdownComponent
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

    new DropdownComponent(group)
      .addOptions(
        Object.fromEntries(
          fileSortModes.map((mode) => [mode, this.fileSortModeLabels[mode]])
        )
      )
      .setValue(this.currentFileSortMode)
      .onChange((value) => {
        this.currentFileSortMode = value as FileSortMode;
        this.callbacks.onFileSortChange(this.currentFileSortMode);
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

    // Re-render toolbar to update dropdown
    if (this.container) {
      this.render(this.container.parentElement!);
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

    // Re-render toolbar to update toggle
    if (this.container) {
      this.render(this.container.parentElement!);
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

    // Re-render toolbar to update view dropdown
    if (this.container) {
      this.render(this.container.parentElement!);
    }
  }
}
