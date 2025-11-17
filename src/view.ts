import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultIndexer } from "./indexer/vault-indexer";
import { TreeBuilder } from "./tree/tree-builder";
import { TreeComponent } from "./components/tree-component";
import { TreeToolbar } from "./components/tree-toolbar";
import { ViewState, SortMode } from "./types/view-state";
import { SearchQueryBuilder } from "./utils/search-query-builder";
import { ObsidianSearch } from "./utils/obsidian-search";
import { TreeNode } from "./types/tree-node";
import type TagTreePlugin from "./main";

export const VIEW_TYPE_TAG_TREE = "tag-tree-view";

export class TagTreeView extends ItemView {
  private indexer!: VaultIndexer;
  private treeBuilder!: TreeBuilder;
  private treeComponent!: TreeComponent;
  private toolbar!: TreeToolbar;
  private plugin: TagTreePlugin;
  private obsidianSearch!: ObsidianSearch;

  // Per-instance state
  private currentViewName: string;
  private saveStateTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500;

  constructor(leaf: WorkspaceLeaf, plugin: TagTreePlugin) {
    super(leaf);
    this.plugin = plugin;
    // Initialize with default view
    this.currentViewName = plugin.settings.defaultViewName;
  }

  getViewType() {
    return VIEW_TYPE_TAG_TREE;
  }

  getDisplayText() {
    return "Tag Tree";
  }

  getIcon() {
    return "tree-deciduous";
  }

  /**
   * Get state for workspace persistence
   */
  getState() {
    return {
      currentViewName: this.currentViewName,
    };
  }

  /**
   * Restore state from workspace
   */
  async setState(state: any, result: any) {
    if (state?.currentViewName) {
      // Verify the view still exists
      const viewExists = this.plugin.settings.savedViews.some(
        (v) => v.name === state.currentViewName
      );
      this.currentViewName = viewExists
        ? state.currentViewName
        : this.plugin.settings.defaultViewName;
    }

    // Call parent setState
    await super.setState(state, result);
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

      // Build tree builder
      this.treeBuilder = new TreeBuilder(this.indexer);

      // Initialize search utility
      this.obsidianSearch = new ObsidianSearch(this.app);

      // Remove loading indicator
      loadingEl.remove();

      // Create tree component with search callback
      this.treeComponent = new TreeComponent(
        this.app,
        () => {
          this.saveViewState();
        },
        (node: TreeNode) => {
          this.handleNodeSearch(node);
        }
      );

      // Restore saved state before rendering
      this.restoreViewState();

      // Create and render toolbar
      const toolbarContainer = container.createDiv("tag-tree-toolbar-container");
      this.toolbar = new TreeToolbar(
        {
          onSortChange: (mode: SortMode) => {
            this.handleSortChange(mode);
          },
          onCollapseAll: () => {
            this.treeComponent.collapseAll();
            this.saveViewState();
          },
          onExpandAll: () => {
            this.treeComponent.expandAll();
            this.saveViewState();
          },
          onExpandToDepth: (depth: number) => {
            this.treeComponent.expandToDepth(depth);
            this.saveViewState();
          },
          onToggleFiles: () => {
            this.treeComponent.toggleFileVisibility();
            this.saveViewState();
          },
          onViewChange: (viewName: string) => {
            this.handleViewChange(viewName);
          },
        },
        this.treeComponent.getSortMode(),
        this.treeComponent.getFileVisibility(),
        this.plugin.settings.savedViews,
        this.currentViewName
      );
      this.toolbar.render(toolbarContainer);

      // Create tree container
      const treeContainer = container.createDiv("tag-tree-content");

      // Build and render tree based on current view
      this.buildAndRenderTree(treeContainer);

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
   * Handle sort mode change from toolbar
   */
  private handleSortChange(mode: SortMode): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Update tree component sort mode
    this.treeComponent.setSortMode(mode);

    // Rebuild and re-render tree
    const container = this.containerEl.querySelector(
      ".tag-tree-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }

    // Save state
    this.saveViewState();
  }

  /**
   * Handle view change from toolbar
   */
  private handleViewChange(viewName: string): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Update current view name
    this.currentViewName = viewName;

    // Update toolbar dropdown to reflect the change
    if (this.toolbar) {
      this.toolbar.setCurrentViewName(viewName);
    }

    // Clear expanded nodes when switching views (or restore view-specific state)
    const viewState = this.plugin.settings.viewStates[viewName];
    if (viewState) {
      this.treeComponent.setExpandedNodes(new Set(viewState.expandedNodes || []));
      if (viewState.showFiles !== undefined) {
        this.treeComponent.setFileVisibility(viewState.showFiles);
      }
      if (viewState.sortMode) {
        this.treeComponent.setSortMode(viewState.sortMode);
      }
    } else {
      // No saved state, use defaults
      this.treeComponent.setExpandedNodes(new Set());
    }

    // Rebuild and re-render tree with new view
    const container = this.containerEl.querySelector(
      ".tag-tree-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }

    // Save the workspace state (which view is active)
    this.app.workspace.requestSaveLayout();
  }

  /**
   * Build and render tree based on current view configuration
   */
  private buildAndRenderTree(container: HTMLElement): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Get the current view configuration
    const viewConfig = this.plugin.settings.savedViews.find(
      (v) => v.name === this.currentViewName
    );

    if (!viewConfig) {
      // Fallback to default view if current view not found
      container.createDiv("tag-tree-error", (el) => {
        el.textContent = `View "${this.currentViewName}" not found. Please check your settings.`;
      });
      return;
    }

    // Build tree from hierarchy configuration
    // TreeBuilder will internally optimize for simple tag hierarchies (depth=-1)
    const tree = this.treeBuilder.buildFromHierarchy(viewConfig);

    // Render tree
    this.treeComponent.render(tree, container);
  }

  /**
   * Refresh the tree when the index is updated
   */
  private refreshTree(): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Re-render with preserved state
    const container = this.containerEl.querySelector(
      ".tag-tree-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }
  }

  /**
   * Public method to refresh the tree (called from plugin when settings change)
   */
  refresh(): void {
    this.refreshTree();
  }

  /**
   * Get the current view name for this instance
   */
  getCurrentViewName(): string {
    return this.currentViewName;
  }

  /**
   * Switch to a different view (public method for command access)
   */
  switchToView(viewName: string): void {
    this.handleViewChange(viewName);
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

    const treeContent = this.containerEl.querySelector(
      ".tag-tree-content"
    ) as HTMLElement;

    const state: ViewState = {
      expandedNodes: Array.from(this.treeComponent.getExpandedNodes()),
      showFiles: this.treeComponent.getFileVisibility(),
      sortMode: this.treeComponent.getSortMode(),
      scrollPosition: treeContent?.scrollTop ?? 0,
    };

    this.plugin.settings.viewStates[this.currentViewName] = state;
    this.plugin.saveSettings();
  }

  /**
   * Restore view state from settings
   */
  private restoreViewState(): void {
    if (!this.treeComponent) {
      return;
    }

    const state = this.plugin.settings.viewStates[this.currentViewName];
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

    // Restore sort mode
    if (state.sortMode) {
      this.treeComponent.setSortMode(state.sortMode);
    }

    // Restore scroll position (with a small delay to ensure DOM is ready)
    if (state.scrollPosition !== undefined) {
      setTimeout(() => {
        const treeContent = this.containerEl.querySelector(
          ".tag-tree-content"
        ) as HTMLElement;
        if (treeContent) {
          treeContent.scrollTop = state.scrollPosition ?? 0;
        }
      }, 50);
    }
  }

  /**
   * Handle node search (triggered by Ctrl+click or Ctrl+keyboard)
   * Builds a search query from the node and opens Obsidian's search view
   */
  private handleNodeSearch(node: TreeNode): void {
    // Get the current view configuration
    const viewConfig = this.plugin.settings.savedViews.find(
      (v) => v.name === this.currentViewName
    );

    if (!viewConfig) {
      console.error(
        `[TagTree] Cannot build search query: view "${this.currentViewName}" not found`
      );
      return;
    }

    // Build the search query
    const queryBuilder = new SearchQueryBuilder(viewConfig);
    const query = queryBuilder.buildQuery(node);

    if (!query) {
      console.warn("[TagTree] No search query generated for node:", node);
      return;
    }

    console.log("[TagTree] Opening search with query:", query);

    // Open the search view with the query
    this.obsidianSearch.openSearchWithQuery(query);
  }
}