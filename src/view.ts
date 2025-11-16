import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultIndexer } from "./indexer/vault-indexer";
import { TreeBuilder } from "./tree/tree-builder";
import { TreeComponent } from "./components/tree-component";
import { ViewState } from "./types/view-state";
import type TagTreePlugin from "./main";

export const VIEW_TYPE_TAG_TREE = "tag-tree-view";

export class TagTreeView extends ItemView {
  private indexer!: VaultIndexer;
  private treeBuilder!: TreeBuilder;
  private treeComponent!: TreeComponent;
  private plugin: TagTreePlugin;

  // State management
  private viewStateKey = "default";
  private saveStateTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500;

  constructor(leaf: WorkspaceLeaf, plugin: TagTreePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_TAG_TREE;
  }

  getDisplayText() {
    return "Tag Tree";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // Create a loading indicator
    const loadingEl = container.createDiv("tag-tree-loading");
    loadingEl.textContent = "Loading tag tree...";

    try {
      // Initialize indexer
      this.indexer = new VaultIndexer(this.app);
      await this.indexer.initialize();

      // Build tree
      this.treeBuilder = new TreeBuilder(this.indexer);
      const tree = this.treeBuilder.buildFromTags();

      // Remove loading indicator
      loadingEl.remove();

      // Render tree UI
      this.treeComponent = new TreeComponent(this.app, () => {
        this.saveViewState();
      });

      // Restore saved state before rendering
      this.restoreViewState();

      this.treeComponent.render(tree, container);

      // Register event listener for index updates
      this.registerEvent(
        this.indexer.on("index-updated", () => {
          this.refreshTree();
        })
      );
    } catch (error) {
      console.error("[TagTree] Error initializing tag tree view:", error);
      loadingEl.remove();
      const errorMessage = error instanceof Error ? error.message : String(error);
      container.createDiv("tag-tree-error", (el) => {
        el.textContent = `Error loading tag tree: ${errorMessage}`;
      });
    }
  }

  async onClose() {
    // Save state before closing
    this.saveViewStateImmediate();

    // Clear any pending debounced saves
    if (this.saveStateTimer) {
      clearTimeout(this.saveStateTimer);
      this.saveStateTimer = null;
    }

    // Cleanup is handled by Obsidian's event system
  }

  /**
   * Refresh the tree when the index is updated
   */
  private refreshTree(): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Rebuild tree
    const tree = this.treeBuilder.buildFromTags();

    // Re-render with preserved state
    const container = this.containerEl.children[1] as HTMLElement;
    this.treeComponent.render(tree, container);
  }

  /**
   * Save current view state (debounced)
   */
  saveViewState(): void {
    // Clear existing timer
    if (this.saveStateTimer) {
      clearTimeout(this.saveStateTimer);
    }

    // Schedule save
    this.saveStateTimer = setTimeout(() => {
      this.saveViewStateImmediate();
      this.saveStateTimer = null;
    }, this.DEBOUNCE_MS);
  }

  /**
   * Save current view state immediately
   */
  private saveViewStateImmediate(): void {
    if (!this.treeComponent) {
      return;
    }

    const state: ViewState = {
      expandedNodes: Array.from(this.treeComponent.getExpandedNodes()),
      showFiles: this.treeComponent.getFileVisibility(),
      sortMode: "none", // Will be used in Phase 2.2
    };

    this.plugin.settings.viewStates[this.viewStateKey] = state;
    this.plugin.saveSettings();
  }

  /**
   * Restore view state from settings
   */
  private restoreViewState(): void {
    if (!this.treeComponent) {
      return;
    }

    const state = this.plugin.settings.viewStates[this.viewStateKey];
    if (!state) {
      return;
    }

    // Restore expanded nodes
    if (state.expandedNodes && state.expandedNodes.length > 0) {
      this.treeComponent.setExpandedNodes(new Set(state.expandedNodes));
    }

    // Restore file visibility
    if (state.showFiles !== undefined) {
      this.treeComponent.setFileVisibility(state.showFiles);
    }

    // Sort mode will be restored in Phase 2.2
  }
}