import { setIcon, DropdownComponent, ButtonComponent, ToggleComponent } from "obsidian";
import { SortMode, FileSortMode } from "../types/view-state";
import { HierarchyConfig, HierarchyDisplayMode } from "../types/hierarchy-config";
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
  onQuickFilterChange?: () => void; // Called when a quick filter value changes
  onDisplayModeToggle?: () => void; // Called when display mode is toggled
  onOpenViewSettings?: () => void; // Called when settings button is clicked
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
  private fileCount: number = 0; // Number of files after filtering
  private originalFilterValues: Map<string, any> = new Map(); // Store original filter values for reset
  private currentDisplayMode: HierarchyDisplayMode = "tree"; // Current display mode
  private displayModeButton: HTMLElement | null = null; // Reference to the display mode toggle button

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
    currentViewConfig: HierarchyConfig | null = null,
    initialDisplayMode: HierarchyDisplayMode = "tree"
  ) {
    this.callbacks = callbacks;
    this.currentFileSortMode = initialFileSortMode;
    this.showFiles = initialShowFiles;
    this.savedViews = savedViews;
    this.currentViewName = currentViewName;
    this.currentViewConfig = currentViewConfig;
    this.currentDisplayMode = initialDisplayMode;
  }

  /**
   * Render the toolbar
   */
  render(container: HTMLElement): void {
    this.container = container;
    container.empty();

    // Create toolbar header container (no longer collapsible)
    const headerContainer = container.createDiv({ cls: "tag-tree-toolbar-header" });

    // First line: View name and switcher
    const headerFirstLine = headerContainer.createDiv({ cls: "tag-tree-toolbar-header-first-line" });

    // View name (no icon)
    const viewTitle = headerFirstLine.createDiv({ cls: "tag-tree-toolbar-title" });
    viewTitle.createSpan({ text: this.currentViewName, cls: "tag-tree-toolbar-view-name" });

    // View switcher icon immediately to the right of view name (if multiple views exist)
    if (this.savedViews.length > 1 && this.callbacks.onViewChange) {
      const viewSwitcherIcon = viewTitle.createEl("button", {
        cls: "clickable-icon tag-tree-view-switcher-icon",
        attr: {
          "aria-label": "Switch view",
        },
      });
      setIcon(viewSwitcherIcon, "chevron-down");
      viewSwitcherIcon.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showViewSwitcherMenu(viewSwitcherIcon);
      });
    }

    // Second line: Header controls group (reordered)
    const headerSecondLine = headerContainer.createDiv({ cls: "tag-tree-toolbar-header-second-line" });
    const headerControlsGroup = headerSecondLine.createDiv({ cls: "tag-tree-header-controls" });

    // Display mode toggle in header (first)
    const displayModeToggle = headerControlsGroup.createEl("button", {
      cls: "clickable-icon tag-tree-header-control",
      attr: {
        "aria-label": `Switch to ${this.currentDisplayMode === "tree" ? "flattened" : "tree"} view`,
      },
    });

    // Set icon based on current mode
    setIcon(displayModeToggle, this.currentDisplayMode === "tree" ? "git-branch" : "list");

    displayModeToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.callbacks.onDisplayModeToggle) {
        this.callbacks.onDisplayModeToggle();
      }
    });

    // Show files toggle in header (second)
    const showFilesToggle = headerControlsGroup.createEl("button", {
      cls: `clickable-icon tag-tree-header-control`,
      attr: {
        "aria-label": "Toggle file visibility",
        "role": "switch",
        "aria-checked": String(this.showFiles)
      },
    });
    setIcon(showFilesToggle, this.showFiles ? "eye" : "eye-off");
    showFilesToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showFiles = !this.showFiles;
      showFilesToggle.empty();
      setIcon(showFilesToggle, this.showFiles ? "eye" : "eye-off");
      showFilesToggle.setAttribute("aria-checked", String(this.showFiles));
      this.callbacks.onToggleFiles();
    });

    // Expand all nodes (third)
    const expandBtn = headerControlsGroup.createEl("button", {
      cls: "clickable-icon tag-tree-header-control",
      attr: {
        "aria-label": "Expand all nodes",
      },
    });
    setIcon(expandBtn, "unfold-vertical");
    expandBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onExpandAll();
    });

    // Collapse all nodes (fourth)
    const collapseBtn = headerControlsGroup.createEl("button", {
      cls: "clickable-icon tag-tree-header-control",
      attr: {
        "aria-label": "Collapse all nodes",
      },
    });
    setIcon(collapseBtn, "fold-vertical");
    collapseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onCollapseAll();
    });

    // Sort files control in header (fifth)
    const sortButton = headerControlsGroup.createEl("button", {
      cls: "clickable-icon tag-tree-header-control",
      attr: {
        "aria-label": "Sort files",
      },
    });
    setIcon(sortButton, "arrow-up-down");
    sortButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showSortMenu(sortButton);
    });

    // Refresh/rebuild tree button in header (sixth)
    if (this.callbacks.onRefreshTree) {
      const refreshBtn = headerControlsGroup.createEl("button", {
        cls: "clickable-icon tag-tree-header-control",
        attr: {
          "aria-label": "Rebuild tree with current filters",
        },
      });
      setIcon(refreshBtn, "refresh-cw");
      refreshBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.callbacks.onRefreshTree) {
          this.callbacks.onRefreshTree();
        }
      });
    }

    // Settings button in header (last)
    if (this.callbacks.onOpenViewSettings) {
      const settingsBtn = headerControlsGroup.createEl("button", {
        cls: "clickable-icon tag-tree-header-control",
        attr: {
          "aria-label": "Open view settings",
        },
      });
      // Try to use an icon that's definitely available
      try {
        setIcon(settingsBtn, "sliders");
      } catch (e) {
        // Fallback: add text if icon fails
        settingsBtn.textContent = "⚙";
        settingsBtn.style.fontSize = "14px";
      }
      settingsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.callbacks.onOpenViewSettings) {
          this.callbacks.onOpenViewSettings();
        }
      });
    }
  }

  /**
   * Show view switcher menu
   */
  private showViewSwitcherMenu(button: HTMLElement): void {
    const { Menu } = require("obsidian");

    const menu = new Menu();

    // Add view options
    this.savedViews.forEach((view) => {
      menu.addItem((item: any) => {
        item
          .setTitle(view.name)
          .setChecked(view.name === this.currentViewName)
          .onClick(() => {
            if (this.callbacks.onViewChange) {
              this.callbacks.onViewChange(view.name);
            }
          });
      });
    });

    // Show menu anchored to the left under the title
    const rect = button.getBoundingClientRect();
    menu.showAtPosition({
      x: rect.left,
      y: rect.bottom,
    });
  }

  /**
   * Show sort options menu
   */
  private showSortMenu(button: HTMLElement): void {
    const { Menu } = require("obsidian");

    const menu = new Menu();

    // Add sort options
    const sortOptions = [
      { value: "alpha-asc", label: "A → Z" },
      { value: "alpha-desc", label: "Z → A" },
      { value: "created-desc", label: "Created ↓" },
      { value: "created-asc", label: "Created ↑" },
      { value: "modified-desc", label: "Modified ↓" },
      { value: "modified-asc", label: "Modified ↑" },
      { value: "size-desc", label: "Size ↓" },
      { value: "size-asc", label: "Size ↑" },
      { value: "none", label: "Unsorted" },
    ];

    sortOptions.forEach(option => {
      menu.addItem((item: any) => {
        item
          .setTitle(option.label)
          .setChecked(option.value === this.currentFileSortMode)
          .onClick(() => {
            this.currentFileSortMode = option.value as FileSortMode;
            this.callbacks.onFileSortChange(this.currentFileSortMode);
          });
      });
    });

    // Show menu at button position
    const rect = button.getBoundingClientRect();
    menu.showAtPosition({
      x: rect.left,
      y: rect.bottom,
    });
  }



  /**
   * Render interactive filter controls (for eye-selected filters)
   */
  private renderInteractiveFilters(container: HTMLElement, interactiveFilters: any[]): void {
    const section = container.createDiv({ cls: "tag-tree-quick-filters" });
    section.style.padding = "var(--size-4-2) var(--size-4-3)";
    section.style.backgroundColor = "var(--background-secondary)";
    section.style.borderRadius = "var(--radius-s)";
    section.style.marginBottom = "var(--size-4-2)";

    // Render each filter as a row
    interactiveFilters.forEach((labeledFilter) => {
      this.renderQuickFilterRow(section, labeledFilter);
    });
  }

  /**
   * Render the filter expression with highlighted quick filter labels
   */
  private renderFilterExpression(container: HTMLElement, interactiveFilters: any[]): void {
    const filters = this.currentViewConfig?.filters;
    if (!filters) return;

    const expression = filters.expression?.trim() || "";

    // Create set of quick filter labels for easy lookup
    const quickFilterLabels = new Set(interactiveFilters.map(f => f.label));

    const expressionContainer = container.createDiv({ cls: "tag-tree-filter-expression" });
    expressionContainer.style.marginBottom = "var(--size-2-1)"; // Reduced gap
    expressionContainer.style.fontSize = "var(--font-ui-small)"; // Standard Obsidian font

    const label = expressionContainer.createSpan({ text: "Expression: " });
    label.style.color = "var(--text-muted)";
    label.style.marginRight = "var(--size-2-1)";

    const expressionEl = expressionContainer.createSpan();
    expressionEl.style.fontFamily = "var(--font-monospace)";

    if (expression) {
      // Parse expression and highlight quick filter labels
      this.renderHighlightedExpression(expressionEl, expression, quickFilterLabels);
    } else {
      // Default to AND all
      const allLabels = filters.filters
        .filter(lf => lf.enabled !== false)
        .map(lf => lf.label);

      allLabels.forEach((label, index) => {
        if (index > 0) {
          expressionEl.createSpan({ text: " & " });
        }
        const labelEl = expressionEl.createSpan({ text: label });
        if (quickFilterLabels.has(label)) {
          labelEl.style.fontWeight = "700";
          labelEl.style.color = "var(--interactive-accent)";
        }
      });

      const defaultLabel = expressionEl.createSpan({ text: " (default)" });
      defaultLabel.style.color = "var(--text-muted)";
    }
  }

  /**
   * Render expression with highlighted quick filter labels
   */
  private renderHighlightedExpression(container: HTMLElement, expression: string, quickFilterLabels: Set<string>): void {
    // Parse expression character by character and highlight filter labels
    let i = 0;
    while (i < expression.length) {
      const char = expression[i];

      // Check if this is a filter label (A-Z)
      if (/[A-Z]/.test(char)) {
        const labelEl = container.createSpan({ text: char });
        if (quickFilterLabels.has(char)) {
          labelEl.style.fontWeight = "700";
          labelEl.style.color = "var(--interactive-accent)";
        }
        i++;
      } else {
        // Other characters (operators, parens, spaces)
        let text = "";
        while (i < expression.length && !/[A-Z]/.test(expression[i])) {
          text += expression[i];
          i++;
        }
        container.createSpan({ text });
      }
    }
  }

  /**
   * Render a single filter row with controls
   */
  private renderQuickFilterRow(container: HTMLElement, labeledFilter: any): void {
    const filter = labeledFilter.filter;

    const row = container.createDiv({ cls: "tag-tree-quick-filter-row" });
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "var(--size-4-2)";
    row.style.marginBottom = "var(--size-4-2)";
    row.style.padding = "var(--size-4-1)";
    row.style.backgroundColor = "var(--background-primary)";
    row.style.borderRadius = "var(--radius-s)";

    // Filter label badge - purple bold text on light background
    const badge = row.createSpan({ text: labeledFilter.label });
    badge.style.display = "inline-block";
    badge.style.padding = "4px 8px";
    badge.style.backgroundColor = "var(--background-secondary)";
    badge.style.color = "var(--interactive-accent)";
    badge.style.borderRadius = "var(--radius-s)";
    badge.style.fontSize = "0.9em";
    badge.style.fontWeight = "700";
    badge.style.minWidth = "24px";
    badge.style.textAlign = "center";

    // Controls container
    const controls = row.createDiv({ cls: "tag-tree-filter-controls" });
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.gap = "var(--size-2-2)";
    controls.style.flex = "1";
    controls.style.flexWrap = "wrap";

    this.renderFilterControls(controls, filter);

    // Reset button
    const resetBtn = row.createEl("button", { cls: "clickable-icon" });
    resetBtn.setAttribute("aria-label", "Reset to configured value");
    setIcon(resetBtn, "reset");
    resetBtn.style.marginLeft = "auto";
    resetBtn.style.padding = "4px";
    resetBtn.addEventListener("click", () => {
      this.resetFilter(labeledFilter);
    });
  }

  /**
   * Reset a filter to its original configured value
   */
  private resetFilter(labeledFilter: any): void {
    const originalFilter = this.originalFilterValues.get(labeledFilter.label);
    if (!originalFilter) return;

    // Restore all properties from the original filter
    Object.keys(originalFilter).forEach(key => {
      labeledFilter.filter[key] = originalFilter[key];
    });

    // Trigger rebuild
    this.onFilterChanged();
  }

  /**
   * Render controls for a specific filter type
   */
  private renderFilterControls(container: HTMLElement, filter: any): void {
    switch (filter.type) {
      case "tag":
        this.renderTagFilterControls(container, filter);
        break;
      case "property-exists":
        this.renderPropertyExistsFilterControls(container, filter);
        break;
      case "property-value":
        this.renderPropertyValueFilterControls(container, filter);
        break;
      case "file-path":
        this.renderFilePathFilterControls(container, filter);
        break;
      case "file-size":
        this.renderFileSizeFilterControls(container, filter);
        break;
      case "file-ctime":
      case "file-mtime":
        this.renderFileDateFilterControls(container, filter);
        break;
      case "link-count":
        this.renderLinkCountFilterControls(container, filter);
        break;
      case "bookmark":
        this.renderBookmarkFilterControls(container, filter);
        break;
      default:
        container.createSpan({ text: this.getFilterDescription(filter), cls: "setting-item-description" });
        break;
    }
  }

  private renderTagFilterControls(container: HTMLElement, filter: any): void {
    // Show tag name as read-only label
    const tagLabel = container.createSpan({ text: filter.tag });
    tagLabel.style.fontWeight = "400";
    tagLabel.style.marginRight = "var(--size-2-2)";

    // Allow changing match mode only
    new DropdownComponent(container)
      .addOption("prefix", "starts with")
      .addOption("exact", "exactly matches")
      .addOption("contains", "contains")
      .setValue(filter.matchMode || "prefix")
      .onChange((value) => {
        filter.matchMode = value as any;
        this.onFilterChanged();
      });
  }

  private renderPropertyExistsFilterControls(container: HTMLElement, filter: any): void {
    // Show property name as read-only label
    const propLabel = container.createSpan({ text: `Property ${filter.property}` });
    propLabel.style.fontWeight = "400";
    propLabel.style.marginRight = "var(--size-2-2)";

    // Allow changing exists/not-exists only
    new DropdownComponent(container)
      .addOption("exists", "exists")
      .addOption("not-exists", "does not exist")
      .setValue(filter.negate ? "not-exists" : "exists")
      .onChange((value) => {
        filter.negate = value === "not-exists";
        this.onFilterChanged();
      });
  }

  private renderPropertyValueFilterControls(container: HTMLElement, filter: any): void {
    // Show property name as read-only label (no quotes, regular font)
    const propLabel = container.createSpan({ text: `Property ${filter.property}` });
    propLabel.style.fontWeight = "400";
    propLabel.style.marginRight = "var(--size-2-2)";

    // For boolean operators, show dropdown instead of toggle
    if (filter.operator === "is-true" || filter.operator === "is-false") {
      new DropdownComponent(container)
        .addOption("is-true", "is true")
        .addOption("is-false", "is false")
        .setValue(filter.operator)
        .onChange((value) => {
          filter.operator = value as any;
          this.onFilterChanged();
        });
    } else {
      // For other operators, show operator and value (allow changing condition only)
      const opLabel = container.createSpan({ text: this.getOperatorLabel(filter.operator) });
      opLabel.style.fontSize = "0.9em";
      opLabel.style.color = "var(--text-muted)";
      opLabel.style.marginRight = "var(--size-2-1)";

      const valueInput = container.createEl("input", { type: "text", cls: "tag-tree-filter-input" });
      valueInput.value = String(filter.value || "");
      valueInput.placeholder = "Value";
      valueInput.style.width = "100px";
      valueInput.addEventListener("change", () => {
        filter.value = valueInput.value;
        this.onFilterChanged();
      });
    }
  }

  private renderFilePathFilterControls(container: HTMLElement, filter: any): void {
    // Show pattern as read-only label
    const patternLabel = container.createSpan({ text: filter.pattern });
    patternLabel.style.fontWeight = "400";
    patternLabel.style.marginRight = "var(--size-2-2)";

    // Allow changing match mode only
    new DropdownComponent(container)
      .addOption("wildcard", "wildcard")
      .addOption("regex", "regex")
      .setValue(filter.matchMode || "wildcard")
      .onChange((value) => {
        filter.matchMode = value as any;
        this.onFilterChanged();
      });
  }

  private renderFileSizeFilterControls(container: HTMLElement, filter: any): void {
    const sizeLabel = container.createSpan({ text: "Size" });
    sizeLabel.style.fontWeight = "400";
    sizeLabel.style.marginRight = "var(--size-2-1)";

    // Allow changing operator and value
    new DropdownComponent(container)
      .addOption("lt", "<")
      .addOption("lte", "≤")
      .addOption("gt", ">")
      .addOption("gte", "≥")
      .setValue(filter.operator || "gte")
      .onChange((value) => {
        filter.operator = value as any;
        this.onFilterChanged();
      });

    const valueInput = container.createEl("input", { type: "text", cls: "tag-tree-filter-input" });
    valueInput.value = String(filter.value || "");
    valueInput.placeholder = "Size (e.g., 1.5 MB)";
    valueInput.style.width = "120px";
    valueInput.addEventListener("change", () => {
      filter.value = valueInput.value;
      this.onFilterChanged();
    });
  }

  private renderFileDateFilterControls(container: HTMLElement, filter: any): void {
    const dateType = filter.type === "file-ctime" ? "Created" : "Modified";
    const typeLabel = container.createSpan({ text: dateType });
    typeLabel.style.fontWeight = "400";
    typeLabel.style.marginRight = "var(--size-2-1)";

    // Allow changing operator and value
    new DropdownComponent(container)
      .addOption("on", "on")
      .addOption("before", "before")
      .addOption("after", "after")
      .addOption("older-than-days", "older than (days)")
      .addOption("within-days", "within last (days)")
      .setValue(filter.operator || "after")
      .onChange((value) => {
        filter.operator = value as any;
        this.onFilterChanged();
      });

    const valueInput = container.createEl("input", { type: "text", cls: "tag-tree-filter-input" });
    valueInput.value = String(filter.value || "");
    valueInput.placeholder = filter.operator === "older-than-days" || filter.operator === "within-days"
      ? "Days"
      : "Date (e.g., 2024-01-01, today, -7d)";
    valueInput.style.width = "150px";
    valueInput.addEventListener("change", () => {
      filter.value = valueInput.value;
      this.onFilterChanged();
    });
  }

  private renderLinkCountFilterControls(container: HTMLElement, filter: any): void {
    // Show link type as read-only label
    const linkTypeLabel = container.createSpan({
      text: filter.linkType === "outlinks" ? "Outlinks" : "Backlinks"
    });
    linkTypeLabel.style.fontWeight = "400";
    linkTypeLabel.style.marginRight = "var(--size-2-2)";

    // Allow changing operator and value only
    new DropdownComponent(container)
      .addOption("lt", "<")
      .addOption("lte", "≤")
      .addOption("gt", ">")
      .addOption("gte", "≥")
      .setValue(filter.operator || "gte")
      .onChange((value) => {
        filter.operator = value as any;
        this.onFilterChanged();
      });

    const valueInput = container.createEl("input", { type: "number", cls: "tag-tree-filter-input" });
    valueInput.value = String(filter.value || "0");
    valueInput.style.width = "80px";
    valueInput.addEventListener("change", () => {
      filter.value = parseInt(valueInput.value) || 0;
      this.onFilterChanged();
    });
  }

  private renderBookmarkFilterControls(container: HTMLElement, filter: any): void {
    const bookmarkLabel = container.createSpan({ text: "File" });
    bookmarkLabel.style.fontWeight = "400";
    bookmarkLabel.style.marginRight = "var(--size-2-1)";

    // Allow changing is/is-not bookmarked
    new DropdownComponent(container)
      .addOption("is-bookmarked", "is bookmarked")
      .addOption("not-bookmarked", "is not bookmarked")
      .setValue(filter.isBookmarked ? "is-bookmarked" : "not-bookmarked")
      .onChange((value) => {
        filter.isBookmarked = value === "is-bookmarked";
        this.onFilterChanged();
      });
  }

  /**
   * Get a readable operator label for display
   */
  private getOperatorLabel(operator: string): string {
    const labelMap: Record<string, string> = {
      "equals": "equals",
      "not-equals": "not equals",
      "contains": "contains",
      "not-contains": "does not contain",
      "starts-with": "starts with",
      "ends-with": "ends with",
      "number-eq": "=",
      "number-lt": "<",
      "number-lte": "≤",
      "number-gt": ">",
      "number-gte": "≥",
      "date-before": "before",
      "date-after": "after",
      "date-eq": "on",
      "date-older-than-days": "older than (days)",
      "date-within-days": "within last (days)",
      "lt": "<",
      "lte": "≤",
      "gt": ">",
      "gte": "≥",
    };
    return labelMap[operator] || operator;
  }

  /**
   * Called when a quick filter value changes
   */
  private onFilterChanged(): void {
    if (this.callbacks.onQuickFilterChange) {
      this.callbacks.onQuickFilterChange();
    }
  }

  /**
   * Render filter descriptions
   */
  private renderFilterDescriptions(container: HTMLElement): void {
    if (!this.currentViewConfig?.filters || !this.currentViewConfig.filters.filters) {
      return;
    }

    const allFilters = this.currentViewConfig.filters.filters.filter(lf => lf.enabled !== false);

    // Show ALL filters (not just eye-selected ones) - no bullets, less indentation, standard font
    const filtersContainer = container.createEl("div", { cls: "tag-tree-filter-descriptions" });
    filtersContainer.style.marginTop = "var(--size-2-1)"; // Reduced gap
    filtersContainer.style.fontSize = "var(--font-ui-medium)"; // Larger font for visibility
    filtersContainer.style.fontWeight = "normal"; // Normal font weight
    filtersContainer.style.color = "var(--text-normal)"; // Explicit color

    allFilters.forEach((labeledFilter) => {
      const filterRow = filtersContainer.createEl("div");
      filterRow.style.marginBottom = "var(--size-2-2)";
      filterRow.style.fontWeight = "normal"; // Normal font weight
      filterRow.style.color = "var(--text-normal)"; // Explicit color

      const filterText = `${labeledFilter.label}: ${this.getFilterDescription(labeledFilter.filter as any)}`;
      filterRow.textContent = filterText;
    });
  }


  /**
   * Get description of the hierarchy configuration
   */
  private getHierarchyDescription(): string {
    if (!this.currentViewConfig?.levels) {
      return "";
    }

    const levels = this.currentViewConfig.levels;
    const descriptions: string[] = [];

    for (const level of levels) {
      if (level.type === "tag") {
        const tagLevel = level as any;
        const key = tagLevel.key || "all tags";
        const depth = tagLevel.depth === -1 ? "unlimited depth" : `${tagLevel.depth} level${tagLevel.depth > 1 ? 's' : ''}`;
        descriptions.push(`Tags: ${key} (${depth})`);
      } else if (level.type === "property") {
        const propLevel = level as any;
        descriptions.push(`Property: ${propLevel.key}`);
      }
    }

    return descriptions.join(" → ");
  }

  /**
   * Get human-readable description of a filter
   */
  private getFilterDescription(filter: any): string {
    switch (filter.type) {
      case "tag": {
        const mode = filter.matchMode === "exact" ? "exactly matches" :
                      filter.matchMode === "contains" ? "contains" : "starts with";
        return `Tag ${mode} ${filter.tag}`;
      }
      case "property-exists":
        return filter.negate ? `File does not have property ${filter.property}` : `File has property ${filter.property}`;
      case "property-value": {
        if (filter.operator === "is-true") {
          return `Property ${filter.property} is true`;
        } else if (filter.operator === "is-false") {
          return `Property ${filter.property} is false`;
        } else {
          const operatorLabel = this.getOperatorLabel(filter.operator);
          return `Property ${filter.property} ${operatorLabel} ${filter.value}`;
        }
      }
      case "file-path": {
        const mode = filter.matchMode === "regex" ? "matches regex" : "matches";
        return `File path ${mode} ${filter.pattern}`;
      }
      case "file-size": {
        const op = filter.operator === "lt" ? "less than" :
                   filter.operator === "lte" ? "at most" :
                   filter.operator === "gt" ? "greater than" :
                   filter.operator === "gte" ? "at least" : filter.operator;
        return `File size is ${op} ${filter.value}`;
      }
      case "file-ctime": {
        if (filter.operator === "older-than-days") {
          return `File created more than ${filter.value} days ago`;
        } else if (filter.operator === "within-days") {
          return `File created within last ${filter.value} days`;
        } else if (filter.operator === "before") {
          return `File created before ${filter.value}`;
        } else if (filter.operator === "after") {
          return `File created after ${filter.value}`;
        } else if (filter.operator === "on") {
          return `File created on ${filter.value}`;
        }
        return `File created ${filter.operator} ${filter.value}`;
      }
      case "file-mtime": {
        if (filter.operator === "older-than-days") {
          return `File modified more than ${filter.value} days ago`;
        } else if (filter.operator === "within-days") {
          return `File modified within last ${filter.value} days`;
        } else if (filter.operator === "before") {
          return `File modified before ${filter.value}`;
        } else if (filter.operator === "after") {
          return `File modified after ${filter.value}`;
        } else if (filter.operator === "on") {
          return `File modified on ${filter.value}`;
        }
        return `File modified ${filter.operator} ${filter.value}`;
      }
      case "link-count": {
        const linkType = filter.linkType === "outlinks" ? "outgoing links" : "backlinks";
        const op = filter.operator === "lt" ? "fewer than" :
                   filter.operator === "lte" ? "at most" :
                   filter.operator === "gt" ? "more than" :
                   filter.operator === "gte" ? "at least" : filter.operator;
        return `File has ${op} ${filter.value} ${linkType}`;
      }
      case "bookmark":
        return filter.isBookmarked ? "File is bookmarked" : "File is not bookmarked";
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

    // Also update the view config if we have it in saved views
    const viewConfig = this.savedViews.find(view => view.name === viewName);
    if (viewConfig) {
      this.setCurrentViewConfig(viewConfig);
    }

    // Clear original filter values when changing views
    // This allows fresh originals to be stored for the new view
    this.originalFilterValues.clear();

    // Trigger a refresh to recount files for the new view
    if (this.callbacks.onRefreshTree) {
      this.callbacks.onRefreshTree();
    }

    // Re-render toolbar to update view dropdown and header
    if (this.container) {
      this.render(this.container);
    }
  }

  /**
   * Get current view config
   */
  getCurrentViewConfig(): HierarchyConfig | null {
    return this.currentViewConfig;
  }

  /**
   * Update the current view config (for filter information)
   */
  setCurrentViewConfig(viewConfig: HierarchyConfig | null): void {
    this.currentViewConfig = viewConfig;

    // Only store original filter values if we don't have them yet
    // This prevents re-storing already-modified values as "originals"
    if (this.originalFilterValues.size === 0 && viewConfig?.filters?.filters) {
      viewConfig.filters.filters.forEach((labeledFilter) => {
        // Deep copy the filter object
        this.originalFilterValues.set(labeledFilter.label, JSON.parse(JSON.stringify(labeledFilter.filter)));
      });
    }

  }

  /**
   * Clear stored original filter values (called when settings are refreshed)
   */
  clearOriginalFilterValues(): void {
    this.originalFilterValues.clear();
  }

  /**
   * Update the file count (number of files after filtering)
   */
  setFileCount(count: number): void {
    if (this.fileCount === count) {
      return;
    }

    this.fileCount = count;

    // Update file count displays without re-rendering the entire toolbar
    if (this.container) {
      // Update count in files count display
      const filesCountEl = this.container.querySelector('.tag-tree-files-count') as HTMLElement;
      if (filesCountEl) {
        const hasFilters = this.currentViewConfig?.filters && this.currentViewConfig.filters.filters?.length > 0;
        filesCountEl.textContent = hasFilters
          ? `Found ${this.fileCount} files (filtered)`
          : `Found ${this.fileCount} files`;
      }

      // Update count in filters title
      const filterCountSpans = this.container.querySelectorAll('.tag-tree-filters-title span:last-child');
      filterCountSpans.forEach(span => {
        span.textContent = `(${this.fileCount} files)`;
      });
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

  /**
   * Set display mode
   */
  setDisplayMode(mode: HierarchyDisplayMode): void {
    if (this.currentDisplayMode === mode) {
      return;
    }

    this.currentDisplayMode = mode;

    // Update the toggle button icon directly
    if (this.container) {
      const displayModeBtn = this.container.querySelector('.tag-tree-display-mode-toggle') as HTMLElement;

      if (displayModeBtn) {
        // Clear existing icon
        displayModeBtn.empty();

        // Set new icon based on current mode
        setIcon(displayModeBtn, this.currentDisplayMode === "tree" ? "git-branch" : "list");

        // Update aria-label and title
        const newLabel = `Switch to ${this.currentDisplayMode === "tree" ? "flattened" : "tree"} view`;
        displayModeBtn.setAttribute("aria-label", newLabel);
        displayModeBtn.setAttribute("title", newLabel);
      }
    }
  }

  /**
   * Get current display mode
   */
  getDisplayMode(): HierarchyDisplayMode {
    return this.currentDisplayMode;
  }
}
