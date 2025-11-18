import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultIndexer } from "./indexer/vault-indexer";
import { TreeBuilder } from "./tree/tree-builder";
import { TreeComponent } from "./components/tree-component";
import { TreeToolbar } from "./components/tree-toolbar";
import { ViewState, SortMode, FileSortMode, DEFAULT_VIEW_STATE } from "./types/view-state";
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
    container.addClass("tag-tree-view-content");

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

      // Create tree component with callbacks
      this.treeComponent = new TreeComponent(
        this.app,
        () => {
          this.saveViewState();
        },
        (node: TreeNode) => {
          this.handleNodeSearch(node);
        },
        (node: TreeNode, mode: SortMode) => {
          this.handleNodeSortChange(node, mode);
        }
      );

      // Restore saved state before rendering
      this.restoreViewState();

      // Create and render toolbar
      const toolbarContainer = container.createDiv("tag-tree-nav-header");
      this.toolbar = new TreeToolbar(
        {
          onFileSortChange: (mode: FileSortMode) => {
            this.handleFileSortChange(mode);
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
        this.treeComponent.getFileSortMode(),
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
   * Handle file sort mode change from toolbar
   */
  private handleFileSortChange(mode: FileSortMode): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Update ViewState FIRST so buildAndRenderTree uses the new sort mode
    const viewState = this.plugin.settings.viewStates[this.currentViewName];
    if (!viewState) {
      this.plugin.settings.viewStates[this.currentViewName] = {
        ...DEFAULT_VIEW_STATE,
        fileSortMode: mode,
      };
    } else {
      viewState.fileSortMode = mode;
    }

    // Update tree component file sort mode (for consistency)
    this.treeComponent.setFileSortMode(mode);

    // Rebuild and re-render tree (will now use the updated ViewState)
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
   * Handle node sort mode change from context menu
   */
  private handleNodeSortChange(node: TreeNode, mode: SortMode): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Get the level index from node metadata
    const levelIndex = node.metadata?.levelIndex;
    if (levelIndex === undefined) {
      console.warn("[TagTree] Cannot change sort mode: node has no levelIndex", node);
      return;
    }

    // Get the current view configuration
    const viewConfig = this.plugin.settings.savedViews.find(
      (v) => v.name === this.currentViewName
    );

    if (!viewConfig) {
      console.error(
        `[TagTree] Cannot change sort mode: view "${this.currentViewName}" not found`
      );
      return;
    }

    // Check if level exists
    if (levelIndex >= viewConfig.levels.length) {
      console.warn(
        `[TagTree] Cannot change sort mode: level ${levelIndex} does not exist in view config`
      );
      return;
    }

    // Update the hierarchy level's sortBy property
    viewConfig.levels[levelIndex].sortBy = mode;

    // Save settings
    this.plugin.saveSettings();

    // Rebuild and re-render tree with new sort mode
    const container = this.containerEl.querySelector(
      ".tag-tree-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }
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
      if (viewState.fileSortMode) {
        this.treeComponent.setFileSortMode(viewState.fileSortMode);
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

    // Apply level color mode to the tree container
    if (viewConfig.levelColorMode && viewConfig.levelColorMode !== "none") {
      container.setAttribute("data-level-color-mode", viewConfig.levelColorMode);
    } else {
      container.removeAttribute("data-level-color-mode");
    }

    // Set data attribute if file color is configured
    if (viewConfig.fileColor) {
      container.setAttribute("data-has-file-color", "true");
    } else {
      container.removeAttribute("data-has-file-color");
    }

    // Apply custom colors as CSS variables
    if (viewConfig.levelColorMode && viewConfig.levelColorMode !== "none") {
      // Default colors (hex format for compatibility)
      const DEFAULT_LEVEL_COLORS = [
        "#b3d9ff",  // Soft blue
        "#b3f0d9",  // Soft green
        "#fff0b3",  // Soft yellow
        "#e6d9ff",  // Soft purple
        "#ffd9b3",  // Soft orange
        "#ffd9f0",  // Soft pink
        "#b3f0ff",  // Soft cyan
      ];

      viewConfig.levels.forEach((level, index) => {
        // Use custom color if set, otherwise use default palette color
        const color = level.color || DEFAULT_LEVEL_COLORS[index % DEFAULT_LEVEL_COLORS.length];
        container.style.setProperty(`--level-${index}-color`, color);
      });

      if (viewConfig.fileColor) {
        container.style.setProperty('--file-color', viewConfig.fileColor);
      } else {
        container.style.removeProperty('--file-color');
      }
    } else {
      // Clear CSS variables if colors are disabled
      viewConfig.levels.forEach((level, index) => {
        container.style.removeProperty(`--level-${index}-color`);
      });
      container.style.removeProperty('--file-color');
    }

    // Build tree from hierarchy configuration
    // TreeBuilder will internally optimize for simple tag hierarchies (depth=-1)
    const viewState = this.plugin.settings.viewStates[this.currentViewName];
    const tree = this.treeBuilder.buildFromHierarchy(viewConfig, viewState);

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
      fileSortMode: this.treeComponent.getFileSortMode(),
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

    // Restore file sort mode
    if (state.fileSortMode) {
      this.treeComponent.setFileSortMode(state.fileSortMode);
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