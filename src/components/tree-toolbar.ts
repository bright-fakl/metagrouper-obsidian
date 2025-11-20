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
  onQuickFilterChange?: () => void; // Called when a quick filter value changes
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
  private originalFilterValues: Map<string, any> = new Map(); // Store original filter values for reset

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

    const btn = new ButtonComponent(group)
      .setButtonText("Apply Filters")
      .setIcon("refresh-cw")
      .setTooltip("Rebuild tree with current filters")
      .onClick(() => {
        if (this.callbacks.onRefreshTree) {
          this.callbacks.onRefreshTree();
        }
      });

    // Make the button more prominent
    btn.buttonEl.addClass("mod-cta");
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

    // Show filter expression with highlighted quick filter labels
    if (this.currentViewConfig?.filters) {
      this.renderFilterExpression(section, interactiveFilters);
    }

    // Title with file count
    const title = section.createEl("div");
    title.style.fontWeight = "600";
    title.style.marginBottom = "var(--size-4-2)";
    title.style.marginTop = "var(--size-4-3)";
    title.style.fontSize = "0.9em";

    title.createSpan({ text: "Quick Filters " });
    const countSpan = title.createSpan({ text: `(${this.fileCount} files)` });
    countSpan.style.color = "var(--text-muted)";
    countSpan.style.fontWeight = "400";

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
    expressionContainer.style.marginBottom = "var(--size-4-2)";
    expressionContainer.style.fontSize = "0.9em";

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
    const tagLabel = container.createSpan({ text: `"${filter.tag}"` });
    tagLabel.style.fontWeight = "500";
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
    const propLabel = container.createSpan({ text: `Property "${filter.property}"` });
    propLabel.style.fontWeight = "500";
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
    const patternLabel = container.createSpan({ text: `"${filter.pattern}"` });
    patternLabel.style.fontWeight = "500";
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
    linkTypeLabel.style.fontWeight = "500";
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
    summary.createSpan({ text: "Filter description" });

    const fileCountEl = summary.createSpan({ text: ` (${this.fileCount} files)` });
    fileCountEl.style.color = "var(--text-muted)";
    fileCountEl.style.fontSize = "0.9em";

    const content = details.createDiv({ cls: "tag-tree-filter-explanation-content" });

    if (!this.currentViewConfig?.filters) {
      content.createSpan({ text: "No filters configured" });
      return;
    }

    const filters = this.currentViewConfig.filters;

    // Show ALL filters (not just eye-selected ones) - no bullets, less indentation, larger font
    const filtersContainer = content.createEl("div");
    filtersContainer.style.marginTop = "var(--size-4-2)";
    filtersContainer.style.fontSize = "0.95em";

    filters.filters.forEach((labeledFilter) => {
      if (labeledFilter.enabled === false) return; // Skip disabled filters

      const filterRow = filtersContainer.createEl("div");
      filterRow.style.marginBottom = "var(--size-2-2)";
      filterRow.style.paddingLeft = "var(--size-2-2)";

      const filterText = `${labeledFilter.label}: ${this.getFilterDescription(labeledFilter.filter as any)}`;
      filterRow.textContent = filterText;
    });
  }

  /**
   * Get human-readable description of a filter
   */
  private getFilterDescription(filter: any): string {
    switch (filter.type) {
      case "tag": {
        const mode = filter.matchMode === "exact" ? "exactly matches" :
                     filter.matchMode === "contains" ? "contains" : "starts with";
        return `Tag ${mode} "${filter.tag}"`;
      }
      case "property-exists":
        return filter.negate ? `File does not have property "${filter.property}"` : `File has property "${filter.property}"`;
      case "property-value": {
        if (filter.operator === "is-true") {
          return `Property "${filter.property}" is true`;
        } else if (filter.operator === "is-false") {
          return `Property "${filter.property}" is false`;
        } else {
          const operatorLabel = this.getOperatorLabel(filter.operator);
          return `Property "${filter.property}" ${operatorLabel} ${filter.value}`;
        }
      }
      case "file-path": {
        const mode = filter.matchMode === "regex" ? "matches regex" : "matches";
        return `File path ${mode} "${filter.pattern}"`;
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

    // Clear original filter values when changing views
    // This allows fresh originals to be stored for the new view
    this.originalFilterValues.clear();

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

    // Only store original filter values if we don't have them yet
    // This prevents re-storing already-modified values as "originals"
    if (this.originalFilterValues.size === 0 && viewConfig?.filters?.filters) {
      viewConfig.filters.filters.forEach((labeledFilter) => {
        // Deep copy the filter object
        this.originalFilterValues.set(labeledFilter.label, JSON.parse(JSON.stringify(labeledFilter.filter)));
      });
    }

    // Re-render toolbar to update filter controls
    if (this.container) {
      this.render(this.container);
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
