import { App, Plugin, PluginManifest, WorkspaceLeaf, MarkdownPostProcessorContext } from "obsidian";
import { TagTreeView, VIEW_TYPE_TAG_TREE } from "./view";
import {
  TagTreeSettings,
  DEFAULT_SETTINGS,
} from "./settings/plugin-settings";
import { TagTreeSettingsTab } from "./settings/settings-tab";
import { TagTreeCodeblockProcessor } from "./codeblock/codeblock-processor";

export default class TagTreePlugin extends Plugin {
  settings!: TagTreeSettings;
  private registeredViewCommands: Set<string> = new Set();

  async onload() {
    // Load settings
    await this.loadSettings();

    // Register settings tab
    this.addSettingTab(new TagTreeSettingsTab(this.app, this));

    this.registerView(
      VIEW_TYPE_TAG_TREE,
      (leaf: WorkspaceLeaf) => new TagTreeView(leaf, this)
    );

    this.addRibbonIcon("tree-deciduous", "Open Tag Tree", () => {
      this.activateView();
    });

    // Register command to open Tag Tree
    this.addCommand({
      id: "open-tag-tree",
      name: "Open Tag Tree",
      callback: () => {
        this.activateView();
      },
    });

    // Register dynamic commands for view switching
    this.registerViewCommands();

    // Register markdown codeblock processor for tagtree blocks
    this.registerMarkdownCodeBlockProcessor(
      "tagtree",
      this.processTagTreeBlock.bind(this)
    );
  }

  /**
   * Process tagtree codeblocks in markdown
   */
  async processTagTreeBlock(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const processor = new TagTreeCodeblockProcessor(this.app, this);
    await processor.render(source, el, ctx);
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAG_TREE);
  }

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAG_TREE);
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_TAG_TREE,
          active: true,
        });
      }
    }
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(VIEW_TYPE_TAG_TREE)[0]
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Refresh all active Tag Tree views that are showing a specific view
   * @param viewName - The name of the view that was updated (optional, refreshes all if not specified)
   */
  refreshAllViews(viewName?: string) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAG_TREE);
    leaves.forEach((leaf) => {
      const view = leaf.view as TagTreeView;
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
   * Switch all active Tag Tree views to a specific view
   * @param viewName - The name of the view to switch to
   */
  private switchToView(viewName: string): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAG_TREE);

    if (leaves.length === 0) {
      // No Tag Tree views open, open one and switch to the view
      this.activateView().then(() => {
        // After activating, switch to the requested view
        const newLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TAG_TREE);
        newLeaves.forEach((leaf) => {
          const view = leaf.view as TagTreeView;
          if (view && typeof view.switchToView === "function") {
            view.switchToView(viewName);
          }
        });
      });
    } else {
      // Switch all existing views
      leaves.forEach((leaf) => {
        const view = leaf.view as TagTreeView;
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