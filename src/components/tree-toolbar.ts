import { setIcon, DropdownComponent, ButtonComponent, ToggleComponent } from "obsidian";
import { SortMode, FileSortMode } from "../types/view-state";
import { HierarchyConfig } from "../types/hierarchy-config";
import { FilterConfig } from "../types/filters";

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
  onRefreshTree?: () => void;
  onFilterOverrideToggle?: (enabled: boolean) => void;
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
  private currentViewConfig: HierarchyConfig | null = null;
  private isCollapsed: boolean = false;
  private filterOverridesEnabled: boolean = false;
  private filterExplanationCollapsed: boolean = true;
  private fileCount: number = 0; // Number of files after filtering

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
    currentViewName: string = "All Tags",
    currentViewConfig: HierarchyConfig | null = null
  ) {
    this.callbacks = callbacks;
    this.currentFileSortMode = initialFileSortMode;
    this.showFiles = initialShowFiles;
    this.savedViews = savedViews;
    this.currentViewName = currentViewName;
    this.currentViewConfig = currentViewConfig;
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

    // Row 3: Refresh button (if filter callback available)
    if (this.callbacks.onRefreshTree) {
      const refreshRow = toolbar.createDiv("tag-tree-toolbar-row");
      this.renderRefreshButton(refreshRow);
    }

    // Interactive filter controls (for eye-selected filters)
    if (this.currentViewConfig?.filters && this.currentViewConfig.filters.filters?.length > 0) {
      const interactiveFilters = this.currentViewConfig.filters.filters.filter(
        lf => lf.enabled !== false && lf.showInToolbar === true
      );
      if (interactiveFilters.length > 0) {
        const filterControlsRow = toolbar.createDiv("tag-tree-toolbar-row");
        this.renderInteractiveFilters(filterControlsRow, interactiveFilters);
      }
    }

    // Filter explanation section (collapsible, if view has filters)
    if (this.currentViewConfig?.filters && this.currentViewConfig.filters.filters?.length > 0) {
      this.renderFilterExplanation(toolbar);
    }
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
        // Don't update currentViewName here - let setCurrentViewName do it
        // This ensures the re-render happens when setCurrentViewName is called
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
   * Render refresh button
   */
  private renderRefreshButton(row: HTMLElement): void {
    const group = row.createDiv({ cls: "tag-tree-toolbar-group" });

    new ButtonComponent(group)
      .setButtonText("Refresh")
      .setIcon("refresh-cw")
      .setTooltip("Rebuild tree with current filters")
      .onClick(() => {
        if (this.callbacks.onRefreshTree) {
          this.callbacks.onRefreshTree();
        }
      });
  }

  /**
   * Render interactive filter controls (for eye-selected filters)
   */
  private renderInteractiveFilters(container: HTMLElement, interactiveFilters: any[]): void {
    const group = container.createDiv({ cls: "tag-tree-toolbar-group tag-tree-interactive-filters" });

    const label = group.createSpan({ text: "Quick Filters: " });
    label.style.marginRight = "var(--size-4-2)";
    label.style.fontWeight = "600";

    interactiveFilters.forEach((labeledFilter, index) => {
      if (index > 0) {
        group.createSpan({ text: " | " }).style.margin = "0 var(--size-2-2)";
      }

      const filterEl = group.createSpan({ cls: "tag-tree-quick-filter" });

      // Filter label badge
      const badge = filterEl.createSpan({ text: labeledFilter.label });
      badge.style.display = "inline-block";
      badge.style.padding = "2px 6px";
      badge.style.marginRight = "4px";
      badge.style.backgroundColor = "var(--interactive-accent)";
      badge.style.color = "var(--text-on-accent)";
      badge.style.borderRadius = "var(--radius-s)";
      badge.style.fontSize = "0.85em";
      badge.style.fontWeight = "600";

      // Filter description
      const desc = filterEl.createSpan({
        text: this.getFilterDescription(labeledFilter.filter),
        cls: "setting-item-description"
      });
      desc.style.fontSize = "0.9em";

      // TODO: Add interactive controls here based on filter type
      // For now, this shows the filter info - interactive controls can be added later
    });
  }

  /**
   * Render filter explanation (collapsible)
   */
  private renderFilterExplanation(toolbar: HTMLElement): void {
    const details = toolbar.createEl("details", {
      cls: "tag-tree-filter-explanation"
    });

    if (!this.filterExplanationCollapsed) {
      details.setAttribute("open", "");
    }

    details.addEventListener("toggle", () => {
      this.filterExplanationCollapsed = !details.hasAttribute("open");
    });

    const summary = details.createEl("summary");
    summary.createSpan({ text: `Filters selected ${this.fileCount} files` });

    const content = details.createDiv({ cls: "tag-tree-filter-explanation-content" });

    if (!this.currentViewConfig?.filters) {
      content.createSpan({ text: "No filters configured" });
      return;
    }

    const filters = this.currentViewConfig.filters;

    // Show expression
    const expression = filters.expression?.trim() || "";
    if (expression) {
      content.createEl("div", {
        text: `Expression: ${expression}`,
        cls: "tag-tree-filter-explanation-mode"
      }).style.fontFamily = "monospace";
    } else {
      // Default to AND all
      const labels = filters.filters.map(lf => lf.label).join(' & ');
      content.createEl("div", {
        text: `Expression: ${labels} (default)`,
        cls: "tag-tree-filter-explanation-mode"
      }).style.fontFamily = "monospace";
    }

    // Show ALL filters (not just eye-selected ones)
    const filtersListEl = content.createEl("ul");
    filters.filters.forEach((labeledFilter) => {
      if (labeledFilter.enabled === false) return; // Skip disabled filters

      const filterText = `${labeledFilter.label}: ${this.getFilterDescription(labeledFilter.filter as any)}`;
      filtersListEl.createEl("li", { text: filterText });
    });
  }

  /**
   * Get human-readable description of a filter
   */
  private getFilterDescription(filter: any): string {
    switch (filter.type) {
      case "tag":
        return `Tag ${filter.matchMode} "${filter.tag}"`;
      case "property-exists":
        return filter.negate ? `Does not have property "${filter.property}"` : `Has property "${filter.property}"`;
      case "property-value": {
        const operatorText = filter.operator === "is-true" ? "is true" :
                             filter.operator === "is-false" ? "is false" :
                             filter.operator;
        return `Property "${filter.property}" ${operatorText}${filter.value !== undefined && filter.value !== "" ? " " + filter.value : ""}`;
      }
      case "file-path":
        return `Path ${filter.matchMode} "${filter.pattern}"`;
      case "file-size":
        return `Size ${filter.operator} ${filter.value}B`;
      case "file-ctime":
        return `Created ${filter.operator} ${filter.value}`;
      case "file-mtime":
        return `Modified ${filter.operator} ${filter.value}`;
      case "link-count":
        return `${filter.linkType} ${filter.operator} ${filter.value}`;
      case "bookmark":
        return filter.isBookmarked ? "Is bookmarked" : "Is not bookmarked";
      default:
        return "Unknown filter";
    }
  }

  /**
   * Render toolbar filter controls (simplified for now)
   */
  private renderToolbarFilterControls(row: HTMLElement): void {
    const group = row.createDiv({ cls: "tag-tree-toolbar-group" });

    // Enable/disable toolbar filters toggle
    const label = group.createSpan({ text: "Toolbar filters: " });
    label.style.marginRight = "var(--size-4-2)";

    new ToggleComponent(group)
      .setValue(this.filterOverridesEnabled)
      .setTooltip("Enable/disable toolbar filter overrides")
      .onChange((value) => {
        this.filterOverridesEnabled = value;
        if (this.callbacks.onFilterOverrideToggle) {
          this.callbacks.onFilterOverrideToggle(value);
        }
      });

    // Note about toolbar filters
    if (this.currentViewConfig?.toolbarFilterTypes && this.currentViewConfig.toolbarFilterTypes.length > 0) {
      const note = group.createSpan({
        text: " (Quick filters coming in next update)",
        cls: "setting-item-description"
      });
      note.style.marginLeft = "var(--size-4-2)";
    }
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
      this.render(this.container);
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
      this.render(this.container);
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

    // Re-render toolbar to update view dropdown and header
    if (this.container) {
      this.render(this.container);
    }
  }

  /**
   * Update the current view config (for filter information)
   */
  setCurrentViewConfig(viewConfig: HierarchyConfig | null): void {
    this.currentViewConfig = viewConfig;

    // Re-render toolbar to update filter controls
    if (this.container) {
      this.render(this.container);
    }
  }

  /**
   * Update the file count (number of files after filtering)
   */
  setFileCount(count: number): void {
    if (this.fileCount === count) {
      return;
    }

    this.fileCount = count;

    // Re-render toolbar to update file count display
    if (this.container) {
      this.render(this.container);
    }
  }

  /**
   * Set filter overrides enabled state
   */
  setFilterOverridesEnabled(enabled: boolean): void {
    if (this.filterOverridesEnabled === enabled) {
      return;
    }

    this.filterOverridesEnabled = enabled;

    // Re-render toolbar to update toggle
    if (this.container) {
      this.render(this.container);
    }
  }
}
