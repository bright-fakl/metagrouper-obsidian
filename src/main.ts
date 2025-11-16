import { App, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import { TagTreeView, VIEW_TYPE_TAG_TREE } from "./view";
import {
  TagTreeSettings,
  DEFAULT_SETTINGS,
} from "./settings/plugin-settings";

export default class TagTreePlugin extends Plugin {
  settings!: TagTreeSettings;

  async onload() {
    // Load settings
    await this.loadSettings();

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
}