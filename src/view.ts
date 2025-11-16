import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultIndexer } from "./indexer/vault-indexer";
import { TreeBuilder } from "./tree/tree-builder";
import { TreeComponent } from "./components/tree-component";

export const VIEW_TYPE_TAG_TREE = "tag-tree-view";

export class TagTreeView extends ItemView {
  private indexer: VaultIndexer;
  private treeBuilder: TreeBuilder;
  private treeComponent: TreeComponent;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_TAG_TREE;
  }

  getDisplayText() {
    return "Tag Tree";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
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
      this.treeComponent = new TreeComponent(this.app);
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
      container.createDiv("tag-tree-error", (el) => {
        el.textContent = `Error loading tag tree: ${error.message}`;
      });
    }
  }

  async onClose() {
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
    const container = this.containerEl.children[1];
    this.treeComponent.render(tree, container);
  }
}