import { App, PluginSettingTab, Setting, Modal, Notice, setIcon, MarkdownRenderer } from "obsidian";
import type TagTreePlugin from "../main";
import {
  HierarchyConfig,
  HierarchyLevel,
  TagHierarchyLevel,
  PropertyHierarchyLevel,
  LevelColorMode,
  validateHierarchyConfig,
  createHierarchyConfig,
  createHierarchyLevel,
  createTagLevel,
  createPropertyLevel,
} from "../types/hierarchy-config";
import { SortMode, FileSortMode } from "../types/view-state";
import { DEFAULT_LEVEL_COLORS } from "./plugin-settings";
import { KOFI_SVG } from "../assets/kofi-logo";
import {
  FilterConfig,
  FilterGroup,
  Filter,
  FilterType,
  FILTER_TYPE_METADATA,
  TagFilter,
  PropertyExistsFilter,
  PropertyValueFilter,
  FilePathFilter,
  FileSizeFilter,
  FileDateFilter,
  LinkCountFilter,
  BookmarkFilter,
  STRING_OPERATORS,
  NUMBER_OPERATORS,
  DATE_OPERATORS,
  BOOLEAN_OPERATORS,
  ARRAY_OPERATORS,
  SIZE_OPERATORS,
  LINK_COUNT_OPERATORS,
} from "../types/filters";
import { generateFilterId } from "../filters/filter-utils";

/**
 * Modal to display the changelog
 */
class ChangelogModal extends Modal {
  private plugin: TagTreePlugin;

  constructor(app: App, plugin: TagTreePlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(`What's new in Tag Tree View v${this.plugin.manifest.version}`);

    // Create scrollable content container
    const scrollContainer = contentEl.createDiv({
      cls: "tag-tree-changelog-content"
    });
    scrollContainer.style.maxHeight = "60vh";
    scrollContainer.style.overflowY = "auto";
    scrollContainer.style.marginBottom = "var(--size-4-4)";
    scrollContainer.style.paddingRight = "var(--size-4-2)";

    // Load and render changelog
    try {
      const adapter = this.app.vault.adapter;
      const changelogPath = `${this.plugin.manifest.dir}/CHANGELOG.md`;
      const changelogContent = await adapter.read(changelogPath);

      // Render markdown
      await MarkdownRenderer.render(
        this.app,
        changelogContent,
        scrollContainer,
        "",
        this.plugin
      );
    } catch (error) {
      scrollContainer.createEl("p", {
        text: "Could not load changelog.",
        cls: "mod-warning"
      });
      console.error("Failed to load changelog:", error);
    }

    // Support section
    const supportSection = contentEl.createDiv({
      cls: "tag-tree-changelog-footer"
    });
    supportSection.style.borderTop = "1px solid var(--background-modifier-border)";
    supportSection.style.paddingTop = "var(--size-4-3)";
    supportSection.style.marginTop = "var(--size-4-3)";

    supportSection.createEl("p", {
      text: "If you find Tag Tree View helpful, please consider supporting its development."
    });

    // Buttons container
    const buttonsContainer = supportSection.createDiv();
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.gap = "var(--size-4-2)";
    buttonsContainer.style.marginTop = "var(--size-4-2)";

    // Buy me a coffee button
    const kofiButton = buttonsContainer.createEl("button", {
      cls: "mod-cta"
    });
    kofiButton.style.display = "flex";
    kofiButton.style.alignItems = "center";
    kofiButton.style.gap = "var(--size-2-2)";

    const kofiIcon = kofiButton.createDiv();
    kofiIcon.innerHTML = KOFI_SVG;
    kofiIcon.style.display = "flex";
    kofiIcon.style.alignItems = "center";

    kofiButton.createSpan({ text: "Buy me a coffee" });
    kofiButton.addEventListener("click", () => {
      window.open("https://ko-fi.com/fabiankloosterman", "_blank");
    });

    // Thanks button
    const thanksButton = buttonsContainer.createEl("button");
    thanksButton.setText("Thanks!");
    thanksButton.addEventListener("click", () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Settings tab for Tag Tree plugin
 * Allows users to create, edit, and manage saved views
 */
export class TagTreeSettingsTab extends PluginSettingTab {
  plugin: TagTreePlugin;

  constructor(app: App, plugin: TagTreePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Main header
    new Setting(containerEl)
      .setHeading()
      .setName("Tag Tree View Settings");

    // What's new section
    this.renderWhatsNew(containerEl);

    // Documentation section
    this.renderDocumentation(containerEl);

    // Support development section
    this.renderSupportDevelopment(containerEl);

    // Saved views list (includes default indicator)
    this.renderSavedViewsList(containerEl);

    // Import/Export section
    this.renderImportExport(containerEl);
  }

  /**
   * Render What's new section
   */
  private renderWhatsNew(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(`What's new in Tag Tree View v${this.plugin.manifest.version}`)
      .setDesc("See the latest features and improvements")
      .addButton((button) =>
        button
          .setButtonText("View changelog")
          .onClick(() => {
            new ChangelogModal(this.app, this.plugin).open();
          })
      );
  }

  /**
   * Render Documentation section
   */
  private renderDocumentation(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Documentation")
      .setDesc("Learn more about using Tag Tree View")
      .addButton((button) =>
        button
          .setButtonText("View documentation")
          .onClick(() => {
            window.open("https://fkloosterman.github.io/tag-tree-obsidian/", "_blank");
          })
      );
  }

  /**
   * Render Support development section
   */
  private renderSupportDevelopment(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName("Support development")
      .setDesc("If you find Tag Tree View helpful, please consider supporting its development.");

    // Create custom button container in the control section
    const buttonContainer = setting.controlEl.createDiv({
      cls: "tag-tree-support-buttons"
    });
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "var(--size-4-2)";
    buttonContainer.style.alignItems = "center";

    // Sponsor button with filled heart icon (light background, red heart)
    const sponsorButton = buttonContainer.createEl("button");
    sponsorButton.style.display = "flex";
    sponsorButton.style.alignItems = "center";
    sponsorButton.style.gap = "var(--size-2-2)";
    sponsorButton.style.backgroundColor = "var(--background-secondary)";
    sponsorButton.style.padding = "var(--size-2-3) var(--size-4-2)";
    sponsorButton.style.borderRadius = "var(--radius-s)";
    sponsorButton.style.border = "1px solid var(--background-modifier-border)";
    sponsorButton.style.cursor = "pointer";

    const heartIcon = sponsorButton.createSpan();
    heartIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#dc2626" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    heartIcon.style.display = "flex";
    heartIcon.style.alignItems = "center";

    sponsorButton.createSpan({ text: "Sponsor" });
    sponsorButton.addEventListener("click", () => {
      window.open("https://github.com/sponsors/fkloosterman", "_blank");
    });

    // Buy me a coffee button with ko-fi logo and ko-fi blue background
    const kofiButton = buttonContainer.createEl("button");
    kofiButton.style.display = "flex";
    kofiButton.style.alignItems = "center";
    kofiButton.style.gap = "var(--size-2-2)";
    kofiButton.style.backgroundColor = "#13C3FF"; // Ko-fi brand blue
    kofiButton.style.color = "white";
    kofiButton.style.padding = "var(--size-2-3) var(--size-4-2)";
    kofiButton.style.borderRadius = "var(--radius-s)";
    kofiButton.style.border = "none";
    kofiButton.style.cursor = "pointer";
    kofiButton.style.fontWeight = "500";

    const kofiIcon = kofiButton.createDiv();
    kofiIcon.innerHTML = KOFI_SVG;
    kofiIcon.style.display = "flex";
    kofiIcon.style.alignItems = "center";

    kofiButton.createSpan({ text: "Buy me a coffee" });
    kofiButton.addEventListener("click", () => {
      window.open("https://ko-fi.com/fabiankloosterman", "_blank");
    });
  }

  /**
   * Render the list of saved views
   */
  private renderSavedViewsList(containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Saved Views");

    new Setting(containerEl)
      .setName("")
      .setDesc("Click the star to set a view as default. Default view cannot be deleted.");

    const listContainer = containerEl.createDiv();

    this.plugin.settings.savedViews.forEach((view, index) => {
      const isDefault = view.name === this.plugin.settings.defaultViewName;

      const viewSetting = new Setting(listContainer)
        .setName(view.name)
        .setDesc(this.getViewDescription(view))
        .addExtraButton((button) =>
          button
            .setIcon(isDefault ? "star" : "star-off")
            .setTooltip(isDefault ? "Default view" : "Set as default view")
            .onClick(async () => {
              this.plugin.settings.defaultViewName = view.name;
              await this.plugin.saveSettings();
              this.display(); // Refresh to update star icons
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("pencil")
            .setTooltip("Edit view")
            .onClick(() => {
              new ViewEditorModal(this.app, this.plugin, view, (edited) => {
                this.plugin.settings.savedViews[index] = edited;
                this.plugin.saveSettings();
                this.plugin.updateViewCommands();
                this.display();
                this.plugin.refreshAllViews(edited.name);
              }).open();
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("copy")
            .setTooltip("Duplicate view")
            .onClick(async () => {
              const duplicated = {
                ...view,
                name: `${view.name} (Copy)`,
              };
              this.plugin.settings.savedViews.push(duplicated);
              await this.plugin.saveSettings();
              this.plugin.updateViewCommands();
              this.display();
              new Notice(`Duplicated view: ${view.name}`);
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip(isDefault ? "Cannot delete default view" : "Delete view")
            .setDisabled(isDefault || this.plugin.settings.savedViews.length <= 1)
            .onClick(async () => {
              // Confirm deletion
              const confirmed = await this.confirmDelete(view.name);
              if (!confirmed) return;

              // Remove the view
              this.plugin.settings.savedViews.splice(index, 1);
              await this.plugin.saveSettings();
              this.plugin.updateViewCommands();
              this.display();
              new Notice(`Deleted view: ${view.name}`);
            })
        );
    });

    // Add new view button
    new Setting(listContainer).addButton((button) =>
      button
        .setButtonText("+ New View")
        .setCta()
        .onClick(() => {
          new ViewEditorModal(this.app, this.plugin, null, (created) => {
            this.plugin.settings.savedViews.push(created);
            this.plugin.saveSettings();
            this.plugin.updateViewCommands(); // Update commands for new view
            this.display(); // Refresh settings UI
            new Notice(`Created view: ${created.name}`);
          }).open();
        })
    );
  }

  /**
   * Render import/export section
   */
  private renderImportExport(containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Import/Export");

    new Setting(containerEl)
      .setName("Export all views")
      .setDesc("Export all saved views to a JSON file")
      .addButton((button) =>
        button.setButtonText("Export").onClick(() => {
          this.exportViews();
        })
      );

    new Setting(containerEl)
      .setName("Import views")
      .setDesc("Import views from a JSON file (will be added to existing views)")
      .addButton((button) =>
        button.setButtonText("Import").onClick(() => {
          this.importViews();
        })
      );
  }

  /**
   * Get a human-readable description of a view
   */
  private getViewDescription(view: HierarchyConfig): string {
    const parts: string[] = [];

    if (view.rootTag) {
      parts.push(`Root: #${view.rootTag}`);
    }

    parts.push(
      `Levels: ${view.levels.map((l) => `${l.type}:${l.key}`).join(" → ")}`
    );

    return parts.join(" | ");
  }

  /**
   * Confirm deletion of a view
   */
  private async confirmDelete(viewName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);
      modal.titleEl.setText("Delete view");
      modal.contentEl.createEl("p", {
        text: `Are you sure you want to delete the view "${viewName}"?`,
      });

      new Setting(modal.contentEl)
        .addButton((button) =>
          button.setButtonText("Cancel").onClick(() => {
            modal.close();
            resolve(false);
          })
        )
        .addButton((button) =>
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(() => {
              modal.close();
              resolve(true);
            })
        );

      modal.open();
    });
  }

  /**
   * Export all views to JSON
   */
  private exportViews(): void {
    const json = JSON.stringify(this.plugin.settings.savedViews, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tag-tree-views.json";
    a.click();
    URL.revokeObjectURL(url);
    new Notice("Views exported successfully");
  }

  /**
   * Import views from JSON file
   */
  private importViews(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text) as HierarchyConfig[];

        // Validate all imported views
        const errors: string[] = [];
        imported.forEach((view, index) => {
          const validation = validateHierarchyConfig(view);
          if (!validation.valid) {
            errors.push(`View ${index + 1} (${view.name}): ${validation.errors.join(", ")}`);
          }
        });

        if (errors.length > 0) {
          new Notice(`Import failed: ${errors.join("; ")}`);
          return;
        }

        // Check for name conflicts and rename if needed
        imported.forEach((view) => {
          let name = view.name;
          let counter = 1;
          while (
            this.plugin.settings.savedViews.some((v) => v.name === name)
          ) {
            name = `${view.name} (${counter})`;
            counter++;
          }
          view.name = name;
        });

        // Add imported views
        this.plugin.settings.savedViews.push(...imported);
        await this.plugin.saveSettings();
        this.plugin.updateViewCommands(); // Update commands for imported views
        this.display(); // Refresh settings UI
        new Notice(`Imported ${imported.length} view(s) successfully`);
      } catch (error) {
        new Notice(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };
    input.click();
  }
}

/**
 * Modal for editing/creating a view
 */
class ViewEditorModal extends Modal {
  private plugin: TagTreePlugin;
  private view: HierarchyConfig | null;
  private onSave: (view: HierarchyConfig) => void;

  // Working copy of the view being edited
  private workingView: HierarchyConfig;

  // Track collapse state to preserve across re-renders
  private collapseState: {
    basic: boolean;
    filters: boolean;
    sorting: boolean;
    colors: boolean;
    levels: boolean;
    levelItems: Map<number, boolean>;
    filterGroups: Map<string, boolean>;
  } = {
    basic: true,
    filters: true,
    sorting: true,
    colors: false,
    levels: true,
    levelItems: new Map(),
    filterGroups: new Map(),
  };

  constructor(
    app: App,
    plugin: TagTreePlugin,
    view: HierarchyConfig | null,
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
          version: 1,
          groups: [],
          combineWithOr: true,
        };
      }
    } else {
      // Create new view with defaults
      this.workingView = createHierarchyConfig({
        name: "New View",
        levels: [createTagLevel({ key: "" })],
        showPartialMatches: false,
        filters: {
          version: 1,
          groups: [],
          combineWithOr: true,
        },
      });
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

    // View name (at the top, outside of sections)
    new Setting(containerEl)
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

    // Filter Options Section (collapsible)
    const filterSection = this.createCollapsibleSection(
      containerEl,
      "Filters",
      "filters",
      true
    );

    // Description
    new Setting(filterSection)
      .setName("")
      .setDesc("Filter which files are shown in this view. Filters within a group use AND logic.");

    // Render filter UI
    this.renderFilters(filterSection);

    // Sorting and Display Options Section (collapsible)
    const sortingSection = this.createCollapsibleSection(
      containerEl,
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

    // Level colors section (collapsible)
    const colorsSection = this.createCollapsibleSection(
      containerEl,
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
          .addOption("background", "Background")
          .addOption("border", "Left border")
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
      containerEl,
      "Hierarchy Levels",
      "levels",
      true
    );

    new Setting(levelsSection)
      .setName("")
      .setDesc("Define how files are grouped at each level (top to bottom)");

    const levelsContainer = levelsSection.createDiv();
    this.renderLevels(levelsContainer);

    // Save/Cancel buttons
    const buttonsContainer = containerEl.createDiv("modal-button-container");
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.justifyContent = "flex-end";
    buttonsContainer.style.gap = "8px";
    buttonsContainer.style.marginTop = "16px";

    new Setting(buttonsContainer)
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
          this.renderEditor(this.contentEl); // Re-render
        })
    );
  }

  /**
   * Render the filters section
   */
  private renderFilters(container: HTMLElement): void {
    const filtersContainer = container.createDiv({ cls: "tag-tree-filters-container" });

    // Group combination mode
    new Setting(filtersContainer)
      .setName("Combine filter groups with")
      .setDesc("How to combine multiple filter groups")
      .addDropdown(dropdown => {
        dropdown
          .addOption("or", "OR (match any group)")
          .addOption("and", "AND (match all groups)")
          .setValue(this.workingView.filters!.combineWithOr ? "or" : "and")
          .onChange(value => {
            this.workingView.filters!.combineWithOr = value === "or";
          });
      });

    // Filter groups
    const groupsContainer = filtersContainer.createDiv({ cls: "tag-tree-filter-groups" });
    this.renderFilterGroups(groupsContainer);

    // Add filter group button
    new Setting(filtersContainer)
      .addButton(button => {
        button
          .setButtonText("+ Add Filter Group")
          .onClick(() => {
            const newGroup: FilterGroup = {
              id: generateFilterId(),
              filters: [],
              enabled: true,
            };
            this.workingView.filters!.groups.push(newGroup);
            this.renderEditor(this.contentEl);
          });
      });
  }

  /**
   * Render all filter groups
   */
  private renderFilterGroups(container: HTMLElement): void {
    container.empty();

    if (!this.workingView.filters!.groups || this.workingView.filters!.groups.length === 0) {
      container.createEl("p", {
        text: "No filter groups. Files will not be filtered.",
        cls: "setting-item-description",
      });
      return;
    }

    this.workingView.filters!.groups.forEach((group, groupIndex) => {
      const groupContainer = container.createDiv({ cls: "tag-tree-filter-group" });

      // Group header
      const groupHeader = groupContainer.createDiv({ cls: "tag-tree-filter-group-header" });

      new Setting(groupHeader)
        .setName(`Filter Group ${groupIndex + 1}`)
        .addText(text => {
          text
            .setPlaceholder("Group name (optional)")
            .setValue(group.name || "")
            .onChange(value => {
              group.name = value.trim() || undefined;
            });
        })
        .addExtraButton(button => {
          button
            .setIcon("trash")
            .setTooltip("Delete group")
            .onClick(() => {
              this.workingView.filters!.groups.splice(groupIndex, 1);
              this.renderEditor(this.contentEl);
            });
        });

      // Filters in this group
      const filtersListContainer = groupContainer.createDiv({ cls: "tag-tree-filter-list" });
      this.renderFiltersList(filtersListContainer, group, groupIndex);

      // Add filter button
      new Setting(groupContainer)
        .addButton(button => {
          button
            .setButtonText("+ Add Filter")
            .onClick(() => {
              this.showFilterTypeSelectModal(group);
            });
        });
    });
  }

  /**
   * Render filters list within a group
   */
  private renderFiltersList(container: HTMLElement, group: FilterGroup, groupIndex: number): void {
    container.empty();

    if (!group.filters || group.filters.length === 0) {
      container.createEl("p", {
        text: "No filters in this group.",
        cls: "setting-item-description",
      });
      return;
    }

    group.filters.forEach((filter, filterIndex) => {
      const filterContainer = container.createDiv({ cls: "tag-tree-filter-item" });
      this.renderFilter(filterContainer, filter, group, filterIndex);
    });
  }

  /**
   * Render a single filter
   */
  private renderFilter(container: HTMLElement, filter: Filter, group: FilterGroup, filterIndex: number): void {
    const setting = new Setting(container);

    // Filter type label
    const metadata = FILTER_TYPE_METADATA[filter.type];
    setting.setName(metadata.name);

    // NOT toggle
    setting.addToggle(toggle => {
      toggle
        .setValue(filter.negate || false)
        .setTooltip("Negate (NOT)")
        .onChange(value => {
          filter.negate = value;
        });
      // Add "NOT" label after checkbox
      const toggleEl = toggle.toggleEl;
      if (filter.negate) {
        toggleEl.parentElement!.createSpan({ text: " NOT", cls: "tag-tree-filter-not-label" });
      }
    });

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
          group.filters.splice(filterIndex, 1);
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
  }

  private renderPropertyValueFilterUI(setting: Setting, filter: PropertyValueFilter): void {
    setting.addText(text => {
      text
        .setPlaceholder("Property name")
        .setValue(filter.property || "")
        .onChange(value => {
          filter.property = value;
        });
    });

    setting.addDropdown(dropdown => {
      // Add operators based on property type
      // For simplicity, show all string operators by default
      STRING_OPERATORS.forEach(op => {
        dropdown.addOption(op.operator, op.label);
      });
      dropdown
        .setValue(filter.operator || "equals")
        .onChange(value => {
          filter.operator = value as any;
        });
    });

    setting.addText(text => {
      text
        .setPlaceholder("Value")
        .setValue(String(filter.value || ""))
        .onChange(value => {
          filter.value = value;
        });
    });
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
      DATE_OPERATORS.forEach(op => {
        dropdown.addOption(op.operator, op.label);
      });
      dropdown
        .setValue(filter.operator || "after")
        .onChange(value => {
          filter.operator = value as any;
        });
    });

    setting.addText(text => {
      text
        .setPlaceholder("Date (e.g., 2024-01-01, today, -7d)")
        .setValue(String(filter.value || ""))
        .onChange(value => {
          filter.value = value;
        });
    });
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
    setting.addDropdown(dropdown => {
      dropdown
        .addOption("true", "Is bookmarked")
        .addOption("false", "Is not bookmarked")
        .setValue(String(filter.isBookmarked ?? true))
        .onChange(value => {
          filter.isBookmarked = value === "true";
        });
    });
  }

  /**
   * Show modal to select filter type
   */
  private showFilterTypeSelectModal(group: FilterGroup): void {
    const modal = new FilterTypeSelectModal(this.app, (filterType: FilterType) => {
      const newFilter = this.createDefaultFilter(filterType);
      group.filters.push(newFilter);
      this.renderEditor(this.contentEl);
    });
    modal.open();
  }

  /**
   * Create a default filter of the given type
   */
  private createDefaultFilter(type: FilterType): Filter {
    const baseFilter = {
      id: generateFilterId(),
      enabled: true,
      negate: false,
    };

    switch (type) {
      case "tag":
        return { ...baseFilter, type: "tag", tag: "", matchMode: "prefix" } as TagFilter;
      case "property-exists":
        return { ...baseFilter, type: "property-exists", property: "" } as PropertyExistsFilter;
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

    // Save
    this.onSave(this.workingView);
    this.close();
  }
}

/**
 * Modal to select a filter type
 */
class FilterTypeSelectModal extends Modal {
  private onSelect: (filterType: FilterType) => void;

  constructor(app: App, onSelect: (filterType: FilterType) => void) {
    super(app);
    this.onSelect = onSelect;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText("Select Filter Type");

    contentEl.createEl("p", {
      text: "Choose the type of filter to add:",
      cls: "setting-item-description",
    });

    // Create a button for each filter type
    const filterTypes: FilterType[] = [
      "tag",
      "property-exists",
      "property-value",
      "file-path",
      "file-size",
      "file-ctime",
      "file-mtime",
      "link-count",
      "bookmark",
    ];

    const buttonsContainer = contentEl.createDiv({ cls: "tag-tree-filter-type-buttons" });
    buttonsContainer.style.display = "grid";
    buttonsContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(200px, 1fr))";
    buttonsContainer.style.gap = "var(--size-4-2)";
    buttonsContainer.style.marginTop = "var(--size-4-4)";

    filterTypes.forEach(filterType => {
      const metadata = FILTER_TYPE_METADATA[filterType];

      const button = buttonsContainer.createEl("button", { cls: "tag-tree-filter-type-button" });
      button.style.padding = "var(--size-4-3)";
      button.style.textAlign = "left";
      button.style.border = "1px solid var(--background-modifier-border)";
      button.style.borderRadius = "var(--radius-s)";
      button.style.backgroundColor = "var(--background-secondary)";
      button.style.cursor = "pointer";

      const iconEl = button.createDiv();
      setIcon(iconEl, metadata.icon);
      iconEl.style.marginBottom = "var(--size-2-2)";

      button.createEl("strong", { text: metadata.name });
      button.createEl("div", {
        text: metadata.description,
        cls: "setting-item-description",
      });

      button.addEventListener("click", () => {
        this.onSelect(filterType);
        this.close();
      });

      button.addEventListener("mouseenter", () => {
        button.style.backgroundColor = "var(--background-modifier-hover)";
      });

      button.addEventListener("mouseleave", () => {
        button.style.backgroundColor = "var(--background-secondary)";
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
