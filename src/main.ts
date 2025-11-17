import { App, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import { TagTreeView, VIEW_TYPE_TAG_TREE } from "./view";
import {
  TagTreeSettings,
  DEFAULT_SETTINGS,
} from "./settings/plugin-settings";
import { TagTreeSettingsTab } from "./settings/settings-tab";

export default class TagTreePlugin extends Plugin {
  settings!: TagTreeSettings;

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
}