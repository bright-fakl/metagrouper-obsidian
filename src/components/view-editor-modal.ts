import { App, Modal, Setting, Notice, setIcon } from "obsidian";
import type TagTreePlugin from "../main";
import { HierarchyConfig, validateHierarchyConfig, createHierarchyConfig, createTagLevel, createPropertyLevel, HierarchyLevel, TagHierarchyLevel, PropertyHierarchyLevel, LevelColorMode } from "../types/hierarchy-config";
import { SortMode, FileSortMode } from "../types/view-state";
import {
  FilterConfig,
  LabeledFilter,
  FilterType,
  Filter,
  TagFilter,
  PropertyExistsFilter,
  PropertyValueFilter,
  FilePathFilter,
  FileSizeFilter,
  FileDateFilter,
  LinkCountFilter,
  BookmarkFilter,
  FILTER_TYPE_METADATA,
  STRING_OPERATORS,
  NUMBER_OPERATORS,
  DATE_OPERATORS,
  FILE_DATE_OPERATORS,
  BOOLEAN_OPERATORS,
  ARRAY_OPERATORS,
  SIZE_OPERATORS,
  LINK_COUNT_OPERATORS,
} from "../types/filters";
import { DEFAULT_LEVEL_COLORS } from "../settings/plugin-settings";
import { ExpressionParser, validateFilterLabels } from "../filters/expression-parser";
import { generateFilterId } from "../filters/filter-utils";

/**
 * Modal for editing/creating a view
 */
export class ViewEditorModal extends Modal {
  private plugin: TagTreePlugin;
  private view: HierarchyConfig | null;
  private onSave: (view: HierarchyConfig) => void;

  // Working copy of the view being edited
  private workingView: HierarchyConfig;

  // Track collapse state to preserve across re-renders
  private collapseState: {
    basic: boolean;
    filters: boolean;
    toolbar: boolean;
    sorting: boolean;
    colors: boolean;
    levels: boolean;
    levelItems: Map<number, boolean>;
  } = {
    basic: true,
    filters: true,
    toolbar: false,
    sorting: true,
    colors: false,
    levels: true,
    levelItems: new Map(),
  };

  constructor(
    app: App,
    plugin: TagTreePlugin,
    view: HierarchyConfig | null,
    effectiveDisplayMode: "tree" | "flat" | null,
    onSave: (view: HierarchyConfig) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.view = view;
    this.onSave = onSave;

    // Create working copy
    if (view) {
      this.workingView = JSON.parse(JSON.stringify(view));
      // Set default levelColorMode if not set
      if (!this.workingView.levelColorMode) {
        this.workingView.levelColorMode = "none";
      }
      // Initialize filters if not present
      if (!this.workingView.filters) {
        this.workingView.filters = {
          version: 2,
          filters: [],
          expression: "",
        };
      }
      // Override displayMode with effective mode if provided
      if (effectiveDisplayMode) {
        this.workingView.displayMode = effectiveDisplayMode;
      }
    } else {
      // Create new view with defaults
      this.workingView = createHierarchyConfig({
        name: "New View",
        levels: [createTagLevel({ key: "" })],
        showPartialMatches: false,
        filters: {
          version: 2,
          filters: [],
          expression: "",
        },
      });
      // Set display mode for new view
      if (effectiveDisplayMode) {
        this.workingView.displayMode = effectiveDisplayMode;
      }
    }
  }

  onOpen() {
    const { contentEl, titleEl } = this;

    titleEl.setText(this.view ? "Edit View" : "Create New View");

    this.renderEditor(contentEl);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Render the view editor form
   */
  private renderEditor(containerEl: HTMLElement): void {
    containerEl.empty();

    // Fixed header with view name
    const header = containerEl.createDiv("tag-tree-modal-header");
    new Setting(header)
      .setName("View name")
      .setDesc("Unique name for this view")
      .addText((text) =>
        text
          .setPlaceholder("My Custom View")
          .setValue(this.workingView.name)
          .onChange((value) => {
            this.workingView.name = value;
          })
      );

    // Create scrollable content wrapper
    const contentWrapper = containerEl.createDiv("tag-tree-modal-content");

    // Filter Options Section (collapsible)
    const filterSection = this.createCollapsibleSection(
      contentWrapper,
      "Filters",
      "filters",
      true
    );

    // Description
    new Setting(filterSection)
      .setName("")
      .setDesc("Filter which files are shown in this view. Define individual filters and combine them with boolean expressions.");

    // Render filter UI
    this.renderFilters(filterSection);

    // Sorting and Display Options Section (collapsible)
    const sortingSection = this.createCollapsibleSection(
      contentWrapper,
      "Sorting & Display Options",
      "sorting",
      true
    );

    // Default node sort mode
    new Setting(sortingSection)
      .setName("Default node sort mode")
      .setDesc("How to sort tag and property nodes in the tree")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("alpha-asc", "Alphabetical (A-Z)")
          .addOption("alpha-desc", "Alphabetical (Z-A)")
          .addOption("count-desc", "File count (Most first)")
          .addOption("count-asc", "File count (Least first)")
          .addOption("none", "Unsorted")
          .setValue(this.workingView.defaultNodeSortMode || "alpha-asc")
          .onChange((value) => {
            this.workingView.defaultNodeSortMode = value as SortMode;
          });
      });

    // Default file sort mode
    new Setting(sortingSection)
      .setName("Default file sort mode")
      .setDesc("How to sort files within each group")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("alpha-asc", "Alphabetical (A-Z)")
          .addOption("alpha-desc", "Alphabetical (Z-A)")
          .addOption("created-desc", "Created (Newest first)")
          .addOption("created-asc", "Created (Oldest first)")
          .addOption("modified-desc", "Modified (Newest first)")
          .addOption("modified-asc", "Modified (Oldest first)")
          .addOption("size-desc", "Size (Largest first)")
          .addOption("size-asc", "Size (Smallest first)")
          .addOption("none", "Unsorted")
          .setValue(this.workingView.defaultFileSortMode || "alpha-asc")
          .onChange((value) => {
            this.workingView.defaultFileSortMode = value as FileSortMode;
          });
      });

    // Default expanded depth
    new Setting(sortingSection)
      .setName("Default expansion depth")
      .setDesc("How many levels to expand by default (-1 for all)")
      .addText((text) =>
        text
          .setPlaceholder("2")
          .setValue(String(this.workingView.defaultExpanded ?? 1))
          .onChange((value) => {
            const num = parseInt(value);
            if (!isNaN(num)) {
              this.workingView.defaultExpanded = num;
            }
          })
      );

    // Show partial matches
    new Setting(sortingSection)
      .setName("Show files with partial matches")
      .setDesc("Show files at the deepest level they match (even if they don't match all levels)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.workingView.showPartialMatches ?? false)
          .onChange((value) => {
            this.workingView.showPartialMatches = value;
          })
      );

    // Display mode
    new Setting(sortingSection)
      .setName("Display mode")
      .setDesc("Choose how to display the hierarchy: tree (nested) or flattened (single level with combined labels)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("tree", "Tree (nested hierarchy)")
          .addOption("flat", "Flattened (single level)")
          .setValue(this.workingView.displayMode ?? "tree")
          .onChange((value) => {
            this.workingView.displayMode = value as "tree" | "flat";
          })
      );

    // Level colors section (collapsible)
    const colorsSection = this.createCollapsibleSection(
      contentWrapper,
      "Hierarchy Level Colors",
      "colors",
      false
    );

    // Color mode dropdown
    new Setting(colorsSection)
      .setName("Level color mode")
      .setDesc("How to apply hierarchy level colors (or none to disable)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("none", "None (disabled)")
          .addOption("text", "Text color")
          .addOption("background", "Background")
          .addOption("left-border", "Left border")
          .addOption("icon", "Icon color")
          .setValue(this.workingView.levelColorMode || "none")
          .onChange((value) => {
            this.workingView.levelColorMode = value as LevelColorMode;
            this.renderEditor(this.contentEl); // Re-render to show/hide color options
          })
      );

    // File color (only show if colors are enabled)
    if (this.workingView.levelColorMode && this.workingView.levelColorMode !== "none") {
      new Setting(colorsSection)
        .setName("File color (optional)")
        .setDesc("Custom color for file nodes (no color by default)")
        .addColorPicker((color) =>
          color
            .setValue(this.workingView.fileColor || "#ffffff")
            .onChange((value) => {
              // Don't save white as the default - only save if user explicitly chose a color
              // (white is just the picker's default display value)
              if (this.workingView.fileColor || value.toLowerCase() !== "#ffffff") {
                this.workingView.fileColor = value;
              }
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("reset")
            .setTooltip("Clear color")
            .onClick(() => {
              this.workingView.fileColor = undefined;
              this.renderEditor(this.contentEl);
            })
        );
    }

    // Hierarchy levels section (collapsible)
    const levelsSection = this.createCollapsibleSection(
      contentWrapper,
      "Hierarchy Levels",
      "levels",
      true
    );

    new Setting(levelsSection)
      .setName("")
      .setDesc("Define how files are grouped at each level (top to bottom)");

    const levelsContainer = levelsSection.createDiv();
    this.renderLevels(levelsContainer);

    // Fixed footer with Save/Cancel buttons
    const footer = containerEl.createDiv("tag-tree-modal-footer");

    new Setting(footer)
      .addButton((button) =>
        button
          .setButtonText("Cancel")
          .onClick(() => {
            this.close();
          })
      )
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            this.saveView();
          })
      );
  }

  /**
   * Create a collapsible section using details/summary with state tracking
   */
  private createCollapsibleSection(
    parent: HTMLElement,
    title: string,
    stateKey: string,
    defaultOpen: boolean = false
  ): HTMLElement {
    const details = parent.createEl("details", { cls: "tag-tree-collapsible-section" });

    // Use stored state if available, otherwise use default
    const isOpen = this.collapseState[stateKey as keyof typeof this.collapseState] ?? defaultOpen;
    if (isOpen) {
      details.setAttribute("open", "");
    }

    const summary = details.createEl("summary", { cls: "tag-tree-section-header" });
    summary.setText(title);

    // Track state changes
    details.addEventListener("toggle", () => {
      (this.collapseState as any)[stateKey] = details.hasAttribute("open");
    });

    const content = details.createDiv("tag-tree-section-content");
    return content;
  }

  /**
   * Get a descriptive title for a hierarchy level
   */
  private getLevelTitle(level: HierarchyLevel, index: number): string {
    const levelNum = index + 1;

    if (level.type === "tag") {
      const tagLevel = level as TagHierarchyLevel;
      const key = level.key || "(empty)";
      const depth = tagLevel.depth === -1 ? "full hierarchy" : `depth ${tagLevel.depth}`;
      return `Level ${levelNum}: #${key} tag (${depth})`;
    } else {
      const key = level.key || "(empty)";
      return `Level ${levelNum}: ${key} property`;
    }
  }

  /**
   * Create a collapsible section for a hierarchy level with controls in header
   */
  private createLevelCollapsible(
    parent: HTMLElement,
    title: string,
    index: number,
    onMoveUp: () => void,
    onMoveDown: () => void,
    onDelete: () => void
  ): HTMLElement {
    const details = parent.createEl("details", { cls: "tag-tree-collapsible-section" });

    // Use stored state if available, otherwise default to collapsed
    const isOpen = this.collapseState.levelItems.get(index) ?? false;
    if (isOpen) {
      details.setAttribute("open", "");
    }

    const summary = details.createEl("summary", { cls: "tag-tree-section-header tag-tree-level-header" });

    // Add title text
    const titleSpan = summary.createSpan({ cls: "tag-tree-level-title" });
    titleSpan.setText(title);

    // Add controls container
    const controls = summary.createDiv({ cls: "tag-tree-level-controls" });

    // Move up button
    const moveUpBtn = controls.createEl("button", {
      cls: "clickable-icon",
      attr: {
        "aria-label": "Move level up",
        "title": "Move level up"
      }
    });
    setIcon(moveUpBtn, "arrow-up");
    if (index === 0) {
      moveUpBtn.addClass("is-disabled");
      moveUpBtn.setAttribute("disabled", "");
    }
    moveUpBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (index > 0) {
        onMoveUp();
      }
    });

    // Move down button
    const moveDownBtn = controls.createEl("button", {
      cls: "clickable-icon",
      attr: {
        "aria-label": "Move level down",
        "title": "Move level down"
      }
    });
    setIcon(moveDownBtn, "arrow-down");
    if (index === this.workingView.levels.length - 1) {
      moveDownBtn.addClass("is-disabled");
      moveDownBtn.setAttribute("disabled", "");
    }
    moveDownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (index < this.workingView.levels.length - 1) {
        onMoveDown();
      }
    });

    // Delete button
    const deleteBtn = controls.createEl("button", {
      cls: "clickable-icon",
      attr: {
        "aria-label": "Delete level",
        "title": "Delete level"
      }
    });
    setIcon(deleteBtn, "trash");
    if (this.workingView.levels.length <= 1) {
      deleteBtn.addClass("is-disabled");
      deleteBtn.setAttribute("disabled", "");
    }
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.workingView.levels.length > 1) {
        onDelete();
      } else {
        new Notice("Cannot delete the last level");
      }
    });

    // Track state changes
    details.addEventListener("toggle", () => {
      this.collapseState.levelItems.set(index, details.hasAttribute("open"));
    });

    const content = details.createDiv("tag-tree-section-content");
    return content;
  }

  /**
   * Render the hierarchy levels list
   */
  private renderLevels(containerEl: HTMLElement): void {
    containerEl.empty();

    this.workingView.levels.forEach((level, index) => {
      // Create collapsible level with descriptive header and controls
      const levelTitle = this.getLevelTitle(level, index);
      const levelContent = this.createLevelCollapsible(
        containerEl,
        levelTitle,
        index,
        () => {
          // Move up
          [this.workingView.levels[index - 1], this.workingView.levels[index]] = [
            this.workingView.levels[index],
            this.workingView.levels[index - 1],
          ];
          this.renderEditor(this.contentEl);
        },
        () => {
          // Move down
          [this.workingView.levels[index], this.workingView.levels[index + 1]] = [
            this.workingView.levels[index + 1],
            this.workingView.levels[index],
          ];
          this.renderEditor(this.contentEl);
        },
        () => {
          // Delete
          this.workingView.levels.splice(index, 1);
          this.renderEditor(this.contentEl);
        }
      );

      const levelContainer = levelContent.createDiv("setting-item-level");

      // Type selector (without action buttons now - they're in the header)
      new Setting(levelContainer)
        .setName("Type")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("tag", "Tag")
            .addOption("property", "Property")
            .setValue(level.type)
            .onChange((value) => {
              // Replace level with new type-specific level
              const newType = value as "tag" | "property";
              if (newType === "tag") {
                this.workingView.levels[index] = createTagLevel({
                  key: level.key,
                  label: level.label,
                });
              } else {
                this.workingView.levels[index] = createPropertyLevel({
                  key: level.key,
                  label: level.label,
                });
              }
              this.renderEditor(this.contentEl); // Re-render to update
            })
        );

      // Key field
      new Setting(levelContainer)
        .setName(level.type === "tag" ? "Tag prefix" : "Property name")
        .setDesc(
          level.type === "tag"
            ? "Tag root to match (empty = all base tags)"
            : "Name of the frontmatter property"
        )
        .addText((text) =>
          text
            .setPlaceholder(
              level.type === "tag" ? "project" : "status"
            )
            .setValue(level.key)
            .onChange((value) => {
              level.key = value;
            })
        );

      // Type-specific fields
      if (level.type === "tag") {
        const tagLevel = level as TagHierarchyLevel;

        // Depth field
        new Setting(levelContainer)
          .setName("Depth")
          .setDesc("Number of tag levels to span (1 or higher for specific depth, -1 for unlimited/full nested hierarchy)")
          .addText((text) =>
            text
              .setPlaceholder("-1")
              .setValue(String(tagLevel.depth ?? -1))
              .onChange((value) => {
                const num = parseInt(value);
                if (!isNaN(num) && (num >= 1 || num === -1)) {
                  tagLevel.depth = num;
                }
              })
          );

        // Virtual toggle
        new Setting(levelContainer)
          .setName("Virtual levels")
          .setDesc("Insert next hierarchy level after each intermediate tag level")
          .addToggle((toggle) =>
            toggle
              .setValue(tagLevel.virtual ?? false)
              .onChange((value) => {
                tagLevel.virtual = value;
              })
          );

        // Show full path toggle
        new Setting(levelContainer)
          .setName("Show full tag path")
          .setDesc("Display full tag path (e.g., 'project/a/task1') instead of just last segment ('task1')")
          .addToggle((toggle) =>
            toggle
              .setValue(tagLevel.showFullPath ?? false)
              .onChange((value) => {
                tagLevel.showFullPath = value;
              })
          );
      } else if (level.type === "property") {
        const propLevel = level as PropertyHierarchyLevel;

        // Separate list values toggle
        new Setting(levelContainer)
          .setName("Separate list values")
          .setDesc("Treat list properties as separate values (true) or single value (false)")
          .addToggle((toggle) =>
            toggle
              .setValue(propLevel.separateListValues ?? true)
              .onChange((value) => {
                propLevel.separateListValues = value;
              })
          );

        // Show property name toggle
        new Setting(levelContainer)
          .setName("Show property name")
          .setDesc("Prepend property name to value (e.g., 'status = active' instead of just 'active')")
          .addToggle((toggle) =>
            toggle
              .setValue(propLevel.showPropertyName ?? false)
              .onChange((value) => {
                propLevel.showPropertyName = value;
              })
          );
      }

      // Optional label
      new Setting(levelContainer)
        .setName("Display label (optional)")
        .setDesc("Custom label to display instead of key")
        .addText((text) =>
          text
            .setPlaceholder(level.key)
            .setValue(level.label || "")
            .onChange((value) => {
              level.label = value.trim() || undefined;
            })
        );

      // Sort override
      new Setting(levelContainer)
        .setName("Sort override (optional)")
        .setDesc("Override the default node sort mode for this specific level")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("", "Use default")
            .addOption("alpha-asc", "Alphabetical (A-Z)")
            .addOption("alpha-desc", "Alphabetical (Z-A)")
            .addOption("count-desc", "File count (Most first)")
            .addOption("count-asc", "File count (Least first)")
            .addOption("none", "Unsorted")
            .setValue(level.sortBy || "")
            .onChange((value) => {
              level.sortBy = value ? (value as SortMode) : undefined;
            });
        });

      // Level color (only show if level colors are enabled for this view)
      if (this.workingView.levelColorMode && this.workingView.levelColorMode !== "none") {
        const defaultColor = DEFAULT_LEVEL_COLORS[index % DEFAULT_LEVEL_COLORS.length];
        new Setting(levelContainer)
          .setName("Level color (optional)")
          .setDesc(`Custom color for level ${index + 1} (default: ${defaultColor})`)
          .addColorPicker((color) =>
            color
              .setValue(level.color || defaultColor)
              .onChange((value) => {
                // Only save if different from default (normalize for comparison)
                if (value.toLowerCase() !== defaultColor.toLowerCase()) {
                  level.color = value;
                } else {
                  level.color = undefined;
                }
              })
          )
          .addExtraButton((button) =>
            button
              .setIcon("reset")
              .setTooltip("Use default color")
              .onClick(() => {
                level.color = undefined;
                this.renderEditor(this.contentEl);
              })
          );
      }
    });

    // Add level button
    new Setting(containerEl).addButton((button) =>
      button
        .setButtonText("+ Add Level")
        .onClick(() => {
          this.workingView.levels.push(
            createTagLevel({ key: "" })
          );
          this.renderEditor(this.contentEl);
        })
    );
  }

  /**
   * Render the filters section
   */
  private renderFilters(container: HTMLElement): void {
    // Ensure filters is initialized
    if (!this.workingView.filters) {
      this.workingView.filters = {
        version: 2,
        filters: [],
        expression: "",
      };
    }

    const filtersContainer = container.createDiv({ cls: "tag-tree-filters-container" });

    // Individual filters list
    const filtersListContainer = filtersContainer.createDiv({ cls: "tag-tree-labeled-filters" });
    this.renderLabeledFilters(filtersListContainer);

    // Add filter button
    new Setting(filtersContainer)
      .addButton(button => {
        button
          .setButtonText("+ Add Filter")
          .onClick(() => {
            this.showFilterTypeSelectModal();
          });
      });

    // Boolean expression input
    const expressionSetting = new Setting(filtersContainer)
      .setName("Boolean Expression")
      .setDesc("Combine filters using: & (AND), | (OR), ! (NOT), (). Leave empty to AND all filters.");

    const filters = this.workingView.filters; // Store reference for closure
    expressionSetting.addTextArea(text => {
      text
        .setPlaceholder("e.g., (A & B) | (C & !D)")
        .setValue(filters.expression || "")
        .onChange(value => {
          filters.expression = value;
          // Validate expression
          this.validateExpression();
        });
      text.inputEl.rows = 3;
      text.inputEl.style.width = "100%";
      text.inputEl.style.fontFamily = "monospace";
    });

    // Expression validation feedback
    const validationContainer = filtersContainer.createDiv({ cls: "tag-tree-expression-validation" });
    this.renderExpressionValidation(validationContainer);
  }

  /**
   * Render all labeled filters
   */
  private renderLabeledFilters(container: HTMLElement): void {
    container.empty();

    if (!this.workingView.filters || !this.workingView.filters.filters || this.workingView.filters.filters.length === 0) {
      container.createEl("p", {
        text: "No filters defined. Add filters below and combine them with a boolean expression.",
        cls: "setting-item-description",
      });
      return;
    }

    // Show available labels
    const labels = this.workingView.filters.filters.map(lf => lf.label).join(', ');
    container.createEl("p", {
      text: `Available labels: ${labels}`,
      cls: "setting-item-description",
    }).style.marginBottom = "var(--size-4-2)";

    this.workingView.filters.filters.forEach((labeledFilter, index) => {
      const filterContainer = container.createDiv({ cls: "tag-tree-filter-item" });
      this.renderLabeledFilter(filterContainer, labeledFilter, index);
    });
  }

  /**
   * Render a single labeled filter
   */
  private renderLabeledFilter(container: HTMLElement, labeledFilter: LabeledFilter, index: number): void {
    const filter = labeledFilter.filter;

    // Clean up negate field from filters that don't use it (legacy cleanup)
    if (filter.type !== "property-exists" && filter.negate !== undefined) {
      delete filter.negate;
    }

    const setting = new Setting(container);

    // Label badge
    const labelBadge = setting.nameEl.createSpan({ cls: "tag-tree-filter-label-badge" });
    labelBadge.setText(labeledFilter.label);
    labelBadge.style.display = "inline-block";
    labelBadge.style.padding = "2px 8px";
    labelBadge.style.marginRight = "8px";
    labelBadge.style.backgroundColor = "var(--interactive-accent)";
    labelBadge.style.color = "var(--text-on-accent)";
    labelBadge.style.borderRadius = "var(--radius-s)";
    labelBadge.style.fontWeight = "600";

    // Filter type label
    const metadata = FILTER_TYPE_METADATA[filter.type];
    setting.setName(`${labeledFilter.label} - ${metadata.name}`);

    // Type-specific UI
    switch (filter.type) {
      case "tag":
        this.renderTagFilterUI(setting, filter as TagFilter);
        break;
      case "property-exists":
        this.renderPropertyExistsFilterUI(setting, filter as PropertyExistsFilter);
        break;
      case "property-value":
        this.renderPropertyValueFilterUI(setting, filter as PropertyValueFilter);
        break;
      case "file-path":
        this.renderFilePathFilterUI(setting, filter as FilePathFilter);
        break;
      case "file-size":
        this.renderFileSizeFilterUI(setting, filter as FileSizeFilter);
        break;
      case "file-ctime":
      case "file-mtime":
        this.renderFileDateFilterUI(setting, filter as FileDateFilter);
        break;
      case "link-count":
        this.renderLinkCountFilterUI(setting, filter as LinkCountFilter);
        break;
      case "bookmark":
        this.renderBookmarkFilterUI(setting, filter as BookmarkFilter);
        break;
    }


    // Delete button
    setting.addExtraButton(button => {
      button
        .setIcon("trash")
        .setTooltip("Delete filter")
        .onClick(() => {
          this.workingView.filters!.filters.splice(index, 1);
          this.renderEditor(this.contentEl);
        });
    });
  }

  // Type-specific filter UI renderers

  private renderTagFilterUI(setting: Setting, filter: TagFilter): void {
    setting.addText(text => {
      text
        .setPlaceholder("Tag name (e.g., project)")
        .setValue(filter.tag || "")
        .onChange(value => {
          filter.tag = value;
        });
    });

    setting.addDropdown(dropdown => {
      dropdown
        .addOption("prefix", "Prefix match")
        .addOption("exact", "Exact match")
        .addOption("contains", "Contains")
        .setValue(filter.matchMode || "prefix")
        .onChange(value => {
          filter.matchMode = value as any;
        });
    });
  }

  private renderPropertyExistsFilterUI(setting: Setting, filter: PropertyExistsFilter): void {
    setting.addText(text => {
      text
        .setPlaceholder("Property name")
        .setValue(filter.property || "")
        .onChange(value => {
          filter.property = value;
        });
    });

    // Dropdown for exists/does not exist
    setting.addDropdown(dropdown => {
      dropdown
        .addOption("exists", "exists")
        .addOption("not-exists", "does not exist")
        .setValue(filter.negate ? "not-exists" : "exists")
        .onChange(value => {
          filter.negate = value === "not-exists";
        });
    });
  }

  private renderPropertyValueFilterUI(setting: Setting, filter: PropertyValueFilter): void {
    // Property name input
    setting.addText(text => {
      text
        .setPlaceholder("Property name")
        .setValue(filter.property || "")
        .onChange(value => {
          filter.property = value;
          // Don't re-render on every keystroke - just update the value
        });

      // Re-render when input loses focus (user finished typing)
      text.inputEl.addEventListener("blur", () => {
        this.renderEditor(this.contentEl);
      });
    });

    // Detect property type and show appropriate operators
    const propertyType = this.detectPropertyType(filter.property);

    // Check for type mismatch between saved filter and actual property
    if (propertyType && filter.valueType && propertyType !== filter.valueType) {
      // Type mismatch detected - show warning
      const warningEl = setting.descEl.createDiv({ cls: "tag-tree-filter-warning" });
      warningEl.style.color = "var(--text-warning)";
      warningEl.style.marginTop = "var(--size-4-1)";
      warningEl.createEl("strong", { text: "⚠️ Type mismatch: " });
      warningEl.appendText(`Property "${filter.property}" is type "${propertyType}" but filter uses type "${filter.valueType}". `);

      const updateBtn = warningEl.createEl("a", { text: "Update to actual type", href: "#" });
      updateBtn.style.marginLeft = "var(--size-2-1)";
      updateBtn.addEventListener("click", (e) => {
        e.preventDefault();
        filter.valueType = propertyType as any;
        this.renderEditor(this.contentEl);
      });

      const keepBtn = warningEl.createEl("a", { text: "Keep current type", href: "#" });
      keepBtn.style.marginLeft = "var(--size-2-1)";
      keepBtn.addEventListener("click", (e) => {
        e.preventDefault();
        // Just dismiss the warning by re-rendering without the type detection
        // Set a flag to prevent showing warning again
        (filter as any)._typeMismatchAcknowledged = true;
        this.renderEditor(this.contentEl);
      });
    }

    // If we detected a type and no mismatch warning was acknowledged, use it
    if (propertyType && !(filter as any)._typeMismatchAcknowledged) {
      filter.valueType = propertyType as any;
    }

    // Add type selector for unregistered properties
    if (!propertyType && filter.property) {
      // Show message that property doesn't exist
      const infoEl = setting.descEl.createDiv({ cls: "tag-tree-filter-info" });
      infoEl.style.color = "var(--text-muted)";
      infoEl.style.marginTop = "var(--size-4-1)";
      infoEl.style.fontSize = "0.9em";
      infoEl.createEl("em", { text: "ℹ️ Property not found in vault. Please select a type:" });

      setting.addDropdown(dropdown => {
        dropdown
          .addOption("", "Select type...")
          .addOption("string", "String")
          .addOption("number", "Number")
          .addOption("date", "Date")
          .addOption("datetime", "Date")
          .addOption("checkbox", "Boolean")
          .addOption("tags", "List")
          .setValue(filter.valueType || "")
          .onChange(value => {
            filter.valueType = value as any;
            // Re-render to update operators when type changes
            this.renderEditor(this.contentEl);
          });
        dropdown.selectEl.style.width = "auto";
      });
    }

    // Determine which operators to show
    const effectiveType = propertyType || filter.valueType;

    // If no type is selected yet, don't show operators or value inputs
    if (!effectiveType || effectiveType === "") {
      setting.setDesc("Please select a property type to continue");
      return;
    }

    let operators = STRING_OPERATORS;

    if (effectiveType === "number") {
      operators = NUMBER_OPERATORS;
    } else if (effectiveType === "date" || effectiveType === "datetime") {
      operators = DATE_OPERATORS;
    } else if (effectiveType === "boolean" || effectiveType === "checkbox") {
      operators = BOOLEAN_OPERATORS;
    } else if (effectiveType === "tags" || effectiveType === "aliases" || effectiveType === "array") {
      operators = ARRAY_OPERATORS;
    }

    // Only show operator dropdown if there's more than one operator
    // or if the single operator requires a value
    const showOperatorDropdown = operators.length > 1 ||
      (operators.length === 1 && operators[0].needsValue);

    if (showOperatorDropdown) {
      // Operator dropdown
      setting.addDropdown(dropdown => {
        operators.forEach(op => {
          dropdown.addOption(op.operator, op.label);
        });

        // Validate current operator against new operators list
        const isValidOperator = operators.some(op => op.operator === filter.operator);
        if (!isValidOperator && operators.length > 0) {
          filter.operator = operators[0].operator as any;
        }

        dropdown
          .setValue(filter.operator || operators[0]?.operator || "equals")
          .onChange(value => {
            filter.operator = value as any;
            // Re-render to show/hide value inputs based on operator
            this.renderEditor(this.contentEl);
          });
      });
    } else {
      // Auto-set the only operator if not already set
      if (operators.length === 1 && (!filter.operator || filter.operator !== operators[0].operator)) {
        filter.operator = operators[0].operator as any;
      }

      // Add a description for single, value-less operators
      if (operators.length === 1 && !operators[0].needsValue) {
        setting.setDesc(`Matches when property is ${operators[0].label}`);
      }
    }

    // Value input (if operator needs a value)
    const currentOp = operators.find(op => op.operator === filter.operator);
    if (!currentOp || currentOp.needsValue) {
      setting.addText(text => {
        text
          .setPlaceholder("Value")
          .setValue(String(filter.value || ""))
          .onChange(value => {
            filter.value = value;
          });
      });

      // For range operators, add max value input
      if (currentOp?.needsValueMax) {
        setting.addText(text => {
          text
            .setPlaceholder("Max value")
            .setValue(String(filter.valueMax || ""))
            .onChange(value => {
              filter.valueMax = value;
            });
          });
      }
    }
  }

  /**
   * Detect property type from Obsidian's metadata type manager
   */
  private detectPropertyType(propertyName: string): string | null {
    if (!propertyName || propertyName.trim() === "") {
      return null;
    }

    const metadataTypeManager = (this.app as any).metadataTypeManager;
    if (!metadataTypeManager) {
      console.log("TagTree: metadataTypeManager not available");
      return null;
    }

    // Try different API methods that might exist
    let propertyInfo = null;

    if (typeof metadataTypeManager.getPropertyInfo === "function") {
      propertyInfo = metadataTypeManager.getPropertyInfo(propertyName);
      console.log(`TagTree: getPropertyInfo("${propertyName}") =>`, propertyInfo);
    } else if (typeof metadataTypeManager.getType === "function") {
      propertyInfo = metadataTypeManager.getType(propertyName);
      console.log(`TagTree: getType("${propertyName}") =>`, propertyInfo);
    } else if (metadataTypeManager.properties) {
      propertyInfo = metadataTypeManager.properties[propertyName];
      console.log(`TagTree: properties["${propertyName}"] =>`, propertyInfo);
    } else {
      console.log("TagTree: metadataTypeManager methods:", Object.keys(metadataTypeManager));
    }

    if (propertyInfo) {
      // Try different ways the type might be stored
      const type = propertyInfo.type || propertyInfo;
      console.log(`TagTree: Detected type for "${propertyName}":`, type);

      // If type is a string, return it directly
      if (typeof type === "string") {
        return type;
      }

      // If type is an object with a widget property, map it to our type
      if (typeof type === "object" && type.widget) {
        const widgetMap: Record<string, string> = {
          "checkbox": "boolean",
          "number": "number",
          "date": "date",
          "datetime": "date",
          "text": "string",
          "multitext": "string",
          "tags": "array",
        };
        const mappedType = widgetMap[type.widget] || "string";
        console.log(`TagTree: Mapped widget "${type.widget}" to type "${mappedType}"`);
        return mappedType;
      }
    }

    return null;
  }

  private renderFilePathFilterUI(setting: Setting, filter: FilePathFilter): void {
    setting.addText(text => {
      text
        .setPlaceholder("Path pattern (e.g., Projects/*)")
        .setValue(filter.pattern || "")
        .onChange(value => {
          filter.pattern = value;
        });
    });

    setting.addDropdown(dropdown => {
      dropdown
        .addOption("wildcard", "Wildcard")
        .addOption("regex", "Regex")
        .setValue(filter.matchMode || "wildcard")
        .onChange(value => {
          filter.matchMode = value as any;
        });
    });
  }

  private renderFileSizeFilterUI(setting: Setting, filter: FileSizeFilter): void {
    setting.addDropdown(dropdown => {
      SIZE_OPERATORS.forEach(op => {
        dropdown.addOption(op.operator, op.label);
      });
      dropdown
        .setValue(filter.operator || "gt")
        .onChange(value => {
          filter.operator = value as any;
        });
    });

    setting.addText(text => {
      text
        .setPlaceholder("Size (e.g., 1.5 MB)")
        .setValue(String(filter.value || ""))
        .onChange(value => {
          filter.value = parseFloat(value) || 0;
        });
    });
  }

  private renderFileDateFilterUI(setting: Setting, filter: FileDateFilter): void {
    setting.addDropdown(dropdown => {
      FILE_DATE_OPERATORS.forEach(op => {
        dropdown.addOption(op.operator, op.label);
      });
      dropdown
        .setValue(filter.operator || "after")
        .onChange(value => {
          filter.operator = value as any;
          // Re-render to show/hide value max input for range operators
          this.renderEditor(this.contentEl);
        });
    });

    setting.addText(text => {
      text
        .setPlaceholder("Date (e.g., 2024-01-01, today, -7d) or Days (for relative)")
        .setValue(String(filter.value || ""))
        .onChange(value => {
          filter.value = value;
        });
    });

    // For range operators, add max value input
    const currentOp = FILE_DATE_OPERATORS.find(op => op.operator === filter.operator);
    if (currentOp?.needsValueMax) {
      setting.addText(text => {
        text
          .setPlaceholder("Max value")
          .setValue(String(filter.valueMax || ""))
          .onChange(value => {
            filter.valueMax = value;
          });
        });
    }
  }

  private renderLinkCountFilterUI(setting: Setting, filter: LinkCountFilter): void {
    setting.addDropdown(dropdown => {
      dropdown
        .addOption("outlinks", "Outlinks")
        .addOption("backlinks", "Backlinks")
        .setValue(filter.linkType || "outlinks")
        .onChange(value => {
          filter.linkType = value as any;
        });
    });

    setting.addDropdown(dropdown => {
      LINK_COUNT_OPERATORS.forEach(op => {
        dropdown.addOption(op.operator, op.label);
      });
      dropdown
        .setValue(filter.operator || "gte")
        .onChange(value => {
          filter.operator = value as any;
        });
    });

    setting.addText(text => {
      text
        .setPlaceholder("Count")
        .setValue(String(filter.value || ""))
        .onChange(value => {
          filter.value = parseInt(value) || 0;
        });
    });
  }

  private renderBookmarkFilterUI(setting: Setting, filter: BookmarkFilter): void {
    // Dropdown for is bookmarked / is not bookmarked
    setting.addDropdown(dropdown => {
      dropdown
        .addOption("is-bookmarked", "is bookmarked")
        .addOption("not-bookmarked", "is not bookmarked")
        .setValue(filter.isBookmarked ? "is-bookmarked" : "not-bookmarked")
        .onChange(value => {
          filter.isBookmarked = value === "is-bookmarked";
        });
    });
  }

  /**
   * Validate the boolean expression
   */
  private validateExpression(): void {
    // Re-render validation container
    const container = this.contentEl.querySelector(".tag-tree-expression-validation") as HTMLElement;
    if (container) {
      this.renderExpressionValidation(container);
    }
  }

  /**
   * Render expression validation feedback
   */
  private renderExpressionValidation(container: HTMLElement): void {
    container.empty();

    // Ensure filters is initialized
    if (!this.workingView.filters) {
      return;
    }

    const expression = this.workingView.filters.expression?.trim() || "";
    const labels = this.workingView.filters.filters?.map(lf => lf.label) || [];

    if (!expression && labels.length > 0) {
      // No expression - will default to AND all
      container.createEl("p", {
        text: `✓ No expression provided - will default to: ${labels.join(' & ')}`,
        cls: "tag-tree-expression-valid",
      }).style.color = "var(--text-muted)";
      return;
    }

    if (!expression) {
      return; // No expression and no filters = nothing to validate
    }

    // Parse expression
    const parser = new ExpressionParser();
    const parseResult = parser.parse(expression);

    if (parseResult.errors.length > 0) {
      // Parse errors
      const errorEl = container.createEl("div", { cls: "tag-tree-expression-error" });
      errorEl.style.color = "var(--text-error)";
      errorEl.createEl("strong", { text: "⚠ Expression Error:" });
      const errorList = errorEl.createEl("ul");
      errorList.style.marginLeft = "20px";
      errorList.style.marginTop = "4px";
      parseResult.errors.forEach(error => {
        errorList.createEl("li", { text: error });
      });
      return;
    }
// Validate labels
const labelErrors = validateFilterLabels(parseResult.ast, labels);
if (labelErrors.length > 0) {
  const errorEl = container.createEl("div", { cls: "tag-tree-expression-error" });
  errorEl.style.color = "var(--text-error)";
  errorEl.createEl("strong", { text: "⚠ Label Error:" });
  const errorList = errorEl.createEl("ul");
  errorList.style.marginLeft = "20px";
  errorList.style.marginTop = "4px";
  labelErrors.forEach(error => {
    errorList.createEl("li", { text: error });
  });
  return;
}
}

  /**
   * Save the view
   */
  private saveView(): void {
// Validate
const validation = validateHierarchyConfig(this.workingView);
if (!validation.valid) {
  new Notice(`Validation failed: ${validation.errors.join(", ")}`);
  return;
}

// Check for duplicate names (only when creating or renaming)
if (
  this.view?.name !== this.workingView.name &&
  this.plugin.settings.savedViews.some(
    (v) => v.name === this.workingView.name
  )
) {
  new Notice(`A view with the name "${this.workingView.name}" already exists`);
  return;
}

// Clear the displayModeOverride since we're saving the effective mode as the config default
if (this.view?.name) {
  const viewState = this.plugin.settings.viewStates[this.view.name];
  if (viewState) {
    delete viewState.displayModeOverride;
  }
}

// Save
this.onSave(this.workingView);
this.close();
}

  /**
   * Show modal to select filter type
   */
  private showFilterTypeSelectModal(): void {
    // Temporarily disabled - FilterTypeSelectModal removed for debugging
    console.log("Filter type selection modal temporarily disabled");
  }

  /**
   * Create a default filter of the given type
   */
  private createDefaultFilter(type: FilterType): Filter {
const baseFilter = {
  id: generateFilterId(),
  enabled: true,
};

switch (type) {
  case "tag":
    return { ...baseFilter, type: "tag", tag: "", matchMode: "prefix" } as TagFilter;
  case "property-exists":
    // PropertyExistsFilter uses negate field for "exists" vs "does not exist"
    return { ...baseFilter, type: "property-exists", property: "", negate: false } as PropertyExistsFilter;
  case "property-value":
    return { ...baseFilter, type: "property-value", property: "", operator: "equals", value: "" } as PropertyValueFilter;
  case "file-path":
    return { ...baseFilter, type: "file-path", pattern: "", matchMode: "wildcard" } as FilePathFilter;
  case "file-size":
    return { ...baseFilter, type: "file-size", operator: "gt", value: 0 } as FileSizeFilter;
  case "file-ctime":
    return { ...baseFilter, type: "file-ctime", operator: "after", value: "" } as FileDateFilter;
  case "file-mtime":
    return { ...baseFilter, type: "file-mtime", operator: "after", value: "" } as FileDateFilter;
  case "link-count":
    return { ...baseFilter, type: "link-count", linkType: "outlinks", operator: "gte", value: 0 } as LinkCountFilter;
  case "bookmark":
    return { ...baseFilter, type: "bookmark", isBookmarked: true } as BookmarkFilter;
  default:
    throw new Error(`Unknown filter type: ${type}`);
}
}

  /**
   * Generate next available label (A, B, C, ...)
   */
  private generateNextLabel(): string {
// Ensure filters is initialized
if (!this.workingView.filters) {
  return "A";
}

const existingLabels = new Set((this.workingView.filters.filters || []).map(lf => lf.label));
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

for (let i = 0; i < alphabet.length; i++) {
  const label = alphabet[i];
  if (!existingLabels.has(label)) {
    return label;
  }
}

// If all single letters are used, start with AA, AB, etc.
for (let i = 0; i < alphabet.length; i++) {
  for (let j = 0; j < alphabet.length; j++) {
    const label = alphabet[i] + alphabet[j];
    if (!existingLabels.has(label)) {
      return label;
    }
  }
}

return "Z" + Date.now(); // Fallback
}
}
   