import { App, PluginSettingTab, Setting, Modal, Notice } from "obsidian";
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

    containerEl.createEl("h2", { text: "Tag Tree Settings" });

    // Default view selector
    this.renderDefaultViewSelector(containerEl);

    // Saved views list
    this.renderSavedViewsList(containerEl);

    // Import/Export section
    this.renderImportExport(containerEl);
  }

  /**
   * Render the default view selector
   */
  private renderDefaultViewSelector(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Default view")
      .setDesc("The view to load when opening a new Tag Tree sidebar")
      .addDropdown((dropdown) => {
        // Add all saved views to dropdown
        this.plugin.settings.savedViews.forEach((view) => {
          dropdown.addOption(view.name, view.name);
        });

        dropdown
          .setValue(this.plugin.settings.defaultViewName)
          .onChange(async (value) => {
            this.plugin.settings.defaultViewName = value;
            await this.plugin.saveSettings();
          });
      });
  }

  /**
   * Render the list of saved views
   */
  private renderSavedViewsList(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Saved Views" });

    const listContainer = containerEl.createDiv("tag-tree-views-list");

    this.plugin.settings.savedViews.forEach((view, index) => {
      const viewSetting = new Setting(listContainer)
        .setName(view.name)
        .setDesc(this.getViewDescription(view))
        .addButton((button) =>
          button.setButtonText("Edit").onClick(() => {
            new ViewEditorModal(this.app, this.plugin, view, (edited) => {
              this.plugin.settings.savedViews[index] = edited;
              this.plugin.saveSettings();
              this.plugin.updateViewCommands(); // Update commands for renamed/edited views
              this.display(); // Refresh settings UI
              this.plugin.refreshAllViews(edited.name);
            }).open();
          })
        )
        .addButton((button) =>
          button
            .setButtonText("Duplicate")
            .setWarning()
            .onClick(async () => {
              const duplicated = {
                ...view,
                name: `${view.name} (Copy)`,
              };
              this.plugin.settings.savedViews.push(duplicated);
              await this.plugin.saveSettings();
              this.plugin.updateViewCommands(); // Update commands for new view
              this.display(); // Refresh settings UI
              new Notice(`Duplicated view: ${view.name}`);
            })
        )
        .addButton((button) =>
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              // Prevent deleting the last view
              if (this.plugin.settings.savedViews.length <= 1) {
                new Notice("Cannot delete the last view");
                return;
              }

              // Prevent deleting the default view
              if (view.name === this.plugin.settings.defaultViewName) {
                new Notice(
                  "Cannot delete the default view. Please set a different default view first."
                );
                return;
              }

              // Confirm deletion
              const confirmed = await this.confirmDelete(view.name);
              if (!confirmed) return;

              // Remove the view
              this.plugin.settings.savedViews.splice(index, 1);
              await this.plugin.saveSettings();
              this.plugin.updateViewCommands(); // Update commands after deletion
              this.display(); // Refresh settings UI
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
    containerEl.createEl("h3", { text: "Import/Export" });

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
      // Fix missing levelColorMode if colors are enabled
      if (this.workingView.enableLevelColors && !this.workingView.levelColorMode) {
        this.workingView.levelColorMode = "background";
      }
    } else {
      // Create new view with defaults
      this.workingView = createHierarchyConfig({
        name: "New View",
        levels: [createTagLevel({ key: "" })],
        showPartialMatches: false,
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

    // View name
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

    // Root tag filter (optional)
    new Setting(containerEl)
      .setName("Root tag filter")
      .setDesc(
        "Optional: Only include files with this tag (e.g., 'project' for #project)"
      )
      .addText((text) =>
        text
          .setPlaceholder("project")
          .setValue(this.workingView.rootTag || "")
          .onChange((value) => {
            this.workingView.rootTag = value.trim() || undefined;
          })
      );

    // Default node sort mode
    new Setting(containerEl)
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
    new Setting(containerEl)
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
    new Setting(containerEl)
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
    new Setting(containerEl)
      .setName("Show files with partial matches")
      .setDesc("Show files at the deepest level they match (even if they don't match all levels)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.workingView.showPartialMatches ?? false)
          .onChange((value) => {
            this.workingView.showPartialMatches = value;
          })
      );

    // Level colors section
    containerEl.createEl("h3", { text: "Hierarchy Level Colors" });

    // Enable level colors
    new Setting(containerEl)
      .setName("Enable level colors")
      .setDesc("Color-code nodes by their hierarchy level")
      .addToggle((toggle) =>
        toggle
          .setValue(this.workingView.enableLevelColors ?? false)
          .onChange((value) => {
            this.workingView.enableLevelColors = value;
            // Set default color mode if enabling and not already set
            if (value && !this.workingView.levelColorMode) {
              this.workingView.levelColorMode = "background";
            }
            this.renderEditor(this.contentEl); // Re-render to show/hide color options
          })
      );

    // Color mode (only show if enabled)
    if (this.workingView.enableLevelColors) {
      new Setting(containerEl)
        .setName("Color mode")
        .setDesc("How to apply hierarchy level colors")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("none", "None")
            .addOption("background", "Background")
            .addOption("border", "Left border")
            .addOption("icon", "Icon color")
            .setValue(this.workingView.levelColorMode || "background")
            .onChange((value) => {
              this.workingView.levelColorMode = value as LevelColorMode;
            })
        );

      // File color
      new Setting(containerEl)
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

    // Hierarchy levels section
    containerEl.createEl("h3", { text: "Hierarchy Levels" });
    containerEl.createEl("p", {
      text: "Define how files are grouped at each level (top to bottom)",
      cls: "setting-item-description",
    });

    const levelsContainer = containerEl.createDiv("tag-tree-levels-container");
    this.renderLevels(levelsContainer);

    // Save/Cancel buttons
    const buttonsContainer = containerEl.createDiv("modal-button-container");
    new Setting(buttonsContainer)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => {
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
   * Render the hierarchy levels list
   */
  private renderLevels(containerEl: HTMLElement): void {
    containerEl.empty();

    this.workingView.levels.forEach((level, index) => {
      const levelContainer = containerEl.createDiv("tag-tree-level-item");
      levelContainer.createEl("h4", { text: `Level ${index + 1}` });

      // Type selector
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
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-up")
            .setTooltip("Move up")
            .onClick(() => {
              if (index > 0) {
                [this.workingView.levels[index - 1], this.workingView.levels[index]] = [
                  this.workingView.levels[index],
                  this.workingView.levels[index - 1],
                ];
                this.renderEditor(this.contentEl); // Re-render
              }
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-down")
            .setTooltip("Move down")
            .onClick(() => {
              if (index < this.workingView.levels.length - 1) {
                [this.workingView.levels[index], this.workingView.levels[index + 1]] = [
                  this.workingView.levels[index + 1],
                  this.workingView.levels[index],
                ];
                this.renderEditor(this.contentEl); // Re-render
              }
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Delete level")
            .onClick(() => {
              if (this.workingView.levels.length > 1) {
                this.workingView.levels.splice(index, 1);
                this.renderEditor(this.contentEl); // Re-render
              } else {
                new Notice("Cannot delete the last level");
              }
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
      if (this.workingView.enableLevelColors) {
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
