import { App, Plugin, PluginManifest, WorkspaceLeaf, MarkdownPostProcessorContext } from "obsidian";
import { MetaGrouperView, VIEW_TYPE_METAGROUPER } from "./view";
import {
  MetaGrouperSettings,
  DEFAULT_SETTINGS,
  migrateSettings,
} from "./settings/plugin-settings";
import { MetaGrouperSettingsTab } from "./settings/settings-tab";
import { MetaGrouperCodeblockProcessor } from "./codeblock/codeblock-processor";

export default class MetaGrouperPlugin extends Plugin {
  settings!: MetaGrouperSettings;
  private registeredViewCommands: Set<string> = new Set();

  async onload() {
    // Load settings
    await this.loadSettings();

    // Register settings tab
    this.addSettingTab(new MetaGrouperSettingsTab(this.app, this));

    this.registerView(
      VIEW_TYPE_METAGROUPER,
      (leaf: WorkspaceLeaf) => new MetaGrouperView(leaf, this)
    );

    this.addRibbonIcon("tree-deciduous", "Open MetaGrouper", () => {
      this.activateView();
    });

    // Register command to open Tag Tree
    this.addCommand({
      id: "open-metagrouper",
      name: "Open MetaGrouper",
      callback: () => {
        this.activateView();
      },
    });

    // Register dynamic commands for view switching
    this.registerViewCommands();

    // Register markdown codeblock processor for metagrouper blocks
    this.registerMarkdownCodeBlockProcessor(
      "metagrouper",
      this.processMetaGrouperBlock.bind(this)
    );
  }

  /**
   * Process metagrouper codeblocks in markdown
   */
  async processMetaGrouperBlock(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const processor = new MetaGrouperCodeblockProcessor(this.app, this);
    await processor.render(source, el, ctx);
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_METAGROUPER);
  }

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_METAGROUPER);
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_METAGROUPER,
          active: true,
        });
      }
    }
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(VIEW_TYPE_METAGROUPER)[0]
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Migrate settings from old schema to new schema
    migrateSettings(this.settings);

    // Save migrated settings
    await this.saveSettings();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Refresh all active MetaGrouper views that are showing a specific view
   * @param viewName - The name of the view that was updated (optional, refreshes all if not specified)
   */
  refreshAllViews(viewName?: string) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_METAGROUPER);
    leaves.forEach((leaf) => {
      const view = leaf.view as MetaGrouperView;
      if (view && typeof view.refresh === "function") {
        if (!viewName || view.getCurrentViewName() === viewName) {
          view.refresh();
        }
      }
    });
  }

  /**
   * Register commands for switching between saved views
   * Commands are dynamically created based on the saved views in settings
   */
  registerViewCommands(): void {
    // Clear any previously registered view commands
    this.registeredViewCommands.forEach((commandId) => {
      // Note: Obsidian doesn't provide a way to unregister commands,
      // but we track them for reference
    });
    this.registeredViewCommands.clear();

    // Register a command for each saved view
    this.settings.savedViews.forEach((view) => {
      const commandId = this.getViewCommandId(view.name);

      this.addCommand({
        id: commandId,
        name: `Switch to "${view.name}" view`,
        callback: () => {
          this.switchToView(view.name);
        },
      });

      this.registeredViewCommands.add(commandId);
    });
  }

  /**
   * Generate a stable command ID from a view name
   * Uses a sanitized version of the view name for consistent command IDs
   */
  private getViewCommandId(viewName: string): string {
    // Sanitize view name to create a stable command ID
    // This ensures keyboard shortcuts are preserved across sessions
    const sanitized = viewName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `switch-to-${sanitized}`;
  }

  /**
   * Switch all active MetaGrouper views to a specific view
   * @param viewName - The name of the view to switch to
   */
  private switchToView(viewName: string): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_METAGROUPER);

    if (leaves.length === 0) {
      // No MetaGrouper views open, open one and switch to the view
      this.activateView().then(() => {
        // After activating, switch to the requested view
        const newLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_METAGROUPER);
        newLeaves.forEach((leaf) => {
          const view = leaf.view as MetaGrouperView;
          if (view && typeof view.switchToView === "function") {
            view.switchToView(viewName);
          }
        });
      });
    } else {
      // Switch all existing views
      leaves.forEach((leaf) => {
        const view = leaf.view as MetaGrouperView;
        if (view && typeof view.switchToView === "function") {
          view.switchToView(viewName);
        }
      });
    }
  }

  /**
   * Re-register view commands when settings change
   * This should be called after adding/removing/renaming views in settings
   */
  updateViewCommands(): void {
    // Note: Obsidian doesn't provide a way to unregister commands,
    // so we just register new ones. Deleted view commands will remain
    // but won't do anything if the view doesn't exist.
    this.registerViewCommands();
  }
}