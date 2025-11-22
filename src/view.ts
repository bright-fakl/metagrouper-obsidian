import { ItemView, WorkspaceLeaf } from "obsidian";
import { VaultIndexer } from "./indexer/vault-indexer";
import { TreeBuilder } from "./tree/tree-builder";
import { TreeComponent } from "./components/tree-component";
import { TreeToolbar } from "./components/tree-toolbar";
import { ViewEditorModal } from "./components/view-editor-modal";
import { ViewState, SortMode, FileSortMode, DEFAULT_VIEW_STATE } from "./types/view-state";
import { HierarchyConfig } from "./types/hierarchy-config";
import { SearchQueryBuilder } from "./utils/search-query-builder";
import { ObsidianSearch } from "./utils/obsidian-search";
import { TreeNode } from "./types/tree-node";
import type MetaGrouperPlugin from "./main";

export const VIEW_TYPE_METAGROUPER = "metagrouper-view";

export class MetaGrouperView extends ItemView {
  private indexer!: VaultIndexer;
  private treeBuilder!: TreeBuilder;
  private treeComponent!: TreeComponent;
  private toolbar!: TreeToolbar;
  private plugin: MetaGrouperPlugin;
  private obsidianSearch!: ObsidianSearch;

  // Per-instance state
  private currentViewName: string;
  private saveStateTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500;

  // Working copy of view config (with toolbar filter modifications)
  private workingViewConfig: HierarchyConfig | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: MetaGrouperPlugin) {
    super(leaf);
    this.plugin = plugin;
    // Initialize with default view
    this.currentViewName = plugin.settings.defaultViewName;
  }

  getViewType() {
    return VIEW_TYPE_METAGROUPER;
  }

  getDisplayText() {
    return "MetaGrouper";
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
    container.addClass("metagrouper-view-content");

    // Create a loading indicator
    const loadingEl = container.createDiv("metagrouper-loading");
    loadingEl.textContent = "Loading metadata index...";

    try {
      // Initialize indexer
      this.indexer = new VaultIndexer(this.app);
      await this.indexer.initialize();

      // Build tree builder
      this.treeBuilder = new TreeBuilder(this.app, this.indexer);

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
      const toolbarContainer = container.createDiv("metagrouper-nav-header");

      // Get current display mode for toolbar initialization
      const viewState = this.plugin.settings.viewStates[this.currentViewName];
      const currentDisplayMode = viewState?.displayModeOverride ?? "tree";

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
          onRefreshTree: () => {
            this.handleRefreshTree();
          },
          onFilterOverrideToggle: (enabled: boolean) => {
            this.handleFilterOverrideToggle(enabled);
          },
          onQuickFilterChange: () => {
            this.handleQuickFilterChange();
          },
          onDisplayModeToggle: () => {
            this.handleDisplayModeToggle();
          },
          onOpenViewSettings: () => {
            this.handleOpenViewSettings();
          },
        },
        this.treeComponent.getFileSortMode(),
        this.treeComponent.getFileVisibility(),
        this.plugin.settings.savedViews,
        this.currentViewName,
        this.getCurrentViewConfig(),
        currentDisplayMode
      );
      this.toolbar.render(toolbarContainer);

      // Create tree container
      const treeContainer = container.createDiv("metagrouper-content");

      // Build and render tree based on current view
      this.buildAndRenderTree(treeContainer);

      // Register event listener for index updates
      this.registerEvent(
        this.indexer.on("index-updated", () => {
          this.refreshTree();
        })
      );
    } catch (error) {
      console.error("[MetaGrouper] Error initializing metagrouper view:", error);
      loadingEl.remove();
      const errorMessage = error instanceof Error ? error.message : String(error);
      container.createDiv("metagrouper-error", (el) => {
        el.textContent = `Error loading MetaGrouper: ${errorMessage}`;
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
      ".metagrouper-content"
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
      console.warn("[MetaGrouper] Cannot change sort mode: node has no levelIndex", node);
      return;
    }

    // Get the current view configuration
    const viewConfig = this.plugin.settings.savedViews.find(
      (v) => v.name === this.currentViewName
    );

    if (!viewConfig) {
      console.error(
        `[MetaGrouper] Cannot change sort mode: view "${this.currentViewName}" not found`
      );
      return;
    }

    // Check if level exists
    if (levelIndex >= viewConfig.levels.length) {
      console.warn(
        `[MetaGrouper] Cannot change sort mode: level ${levelIndex} does not exist in view config`
      );
      return;
    }

    // Update the hierarchy level's sortBy property
    viewConfig.levels[levelIndex].sortBy = mode;

    // Save settings
    this.plugin.saveSettings();

    // Rebuild and re-render tree with new sort mode
    const container = this.containerEl.querySelector(
      ".metagrouper-content"
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

    // Reset working config when changing views
    this.workingViewConfig = null;

    // Update toolbar dropdown to reflect the change
    if (this.toolbar) {
      this.toolbar.setCurrentViewName(viewName);
      this.toolbar.setCurrentViewConfig(this.getCurrentViewConfig());

      // Update display mode for the new view
      const newViewState = this.plugin.settings.viewStates[viewName];
      const newDisplayMode = newViewState?.displayModeOverride ?? "tree";
      this.toolbar.setDisplayMode(newDisplayMode);
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
      ".metagrouper-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }

    // Save the workspace state (which view is active)
    this.app.workspace.requestSaveLayout();
  }

  /**
   * Get current view configuration
   */
  private getCurrentViewConfig(): HierarchyConfig | null {
    return this.plugin.settings.savedViews.find(
      (v) => v.name === this.currentViewName
    ) || null;
  }

  /**
   * Handle refresh tree button click
   */
  private handleRefreshTree(): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Rebuild and re-render tree with current filters
    const container = this.containerEl.querySelector(
      ".metagrouper-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }
  }

  /**
   * Handle filter override toggle
   */
  private handleFilterOverrideToggle(enabled: boolean): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Update view state
    const viewState = this.plugin.settings.viewStates[this.currentViewName];
    if (!viewState) {
      this.plugin.settings.viewStates[this.currentViewName] = {
        ...DEFAULT_VIEW_STATE,
        filterOverrides: {
          enabled: enabled,
          filters: {
            version: 2,
            filters: [],
            expression: "",
          },
        },
      };
    } else {
      if (!viewState.filterOverrides) {
        viewState.filterOverrides = {
          enabled: enabled,
          filters: {
            version: 2,
            filters: [],
            expression: "",
          },
        };
      } else {
        viewState.filterOverrides.enabled = enabled;
      }
    }

    // Save settings
    this.plugin.saveSettings();

    // Rebuild tree if needed (when disabling, revert to saved filters)
    if (!enabled) {
      const container = this.containerEl.querySelector(
        ".metagrouper-content"
      ) as HTMLElement;
      if (container) {
        this.buildAndRenderTree(container);
      }
    }
  }

  /**
   * Handle quick filter value changes from toolbar
   */
  private handleQuickFilterChange(): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // DO NOT save settings - toolbar filter changes are temporary overrides
    // The filter values are modified in the config object in memory only

    // Rebuild tree to apply new filter values
    const container = this.containerEl.querySelector(
      ".metagrouper-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }
  }

  /**
   * Handle settings button click from toolbar
   */
  private handleOpenViewSettings(): void {
    // Get the current view configuration
    const currentViewConfig = this.getCurrentViewConfig();
    if (!currentViewConfig) {
      console.error("[MetaGrouperView] Cannot open settings: no current view config");
      return;
    }

    // Get the effective display mode
    const viewState = this.plugin.settings.viewStates[this.currentViewName];
    const effectiveDisplayMode = viewState?.displayModeOverride ?? currentViewConfig.displayMode ?? "tree";

    // Open the view editor modal for the current view
    const modal = new ViewEditorModal(this.app, this.plugin, currentViewConfig, effectiveDisplayMode, (edited: HierarchyConfig) => {
      // Find the index of the current view
      const viewIndex = this.plugin.settings.savedViews.findIndex(v => v.name === this.currentViewName);
      if (viewIndex !== -1) {
        this.plugin.settings.savedViews[viewIndex] = edited;
        this.plugin.saveSettings();
        this.plugin.updateViewCommands();

        // Update the current view name if it changed
        if (edited.name !== this.currentViewName) {
          this.currentViewName = edited.name;
          this.app.workspace.requestSaveLayout();
        }

        // Refresh all views with the updated view
        this.plugin.refreshAllViews(edited.name);
      }
    });

    modal.open();
  }

  /**
   * Handle display mode toggle from toolbar
   */
  private handleDisplayModeToggle(): void {
    console.log("[MetaGrouperView] handleDisplayModeToggle called");
    
    if (!this.treeBuilder || !this.treeComponent) {
      console.log("[MetaGrouperView] Missing treeBuilder or treeComponent");
      return;
    }

    // Get current view state
    let viewState = this.plugin.settings.viewStates[this.currentViewName];
    const oldMode = viewState?.displayModeOverride ?? "tree";
    
    if (!viewState) {
      this.plugin.settings.viewStates[this.currentViewName] = {
        ...DEFAULT_VIEW_STATE,
        displayModeOverride: "flat", // Toggle from default "tree" to "flat"
      };
      viewState = this.plugin.settings.viewStates[this.currentViewName];
    } else {
      // Toggle between "tree" and "flat"
      const currentMode = viewState.displayModeOverride ?? "tree";
      viewState.displayModeOverride = currentMode === "tree" ? "flat" : "tree";
    }
    
    const newMode = viewState.displayModeOverride;
    console.log("[MetaGrouperView] Mode change:", { from: oldMode, to: newMode });

    // Save settings IMMEDIATELY before rebuild to ensure mode is persisted
    this.plugin.saveSettings();

    // Reset expanded nodes and expansion initialization state since tree structure changes completely between flat and tree views
    this.treeComponent.resetExpansionState();

    // Rebuild and re-render tree with new display mode
    const container = this.containerEl.querySelector(
      ".metagrouper-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }

    // Update toolbar display mode AFTER rebuilding tree to ensure button state is correct
    if (this.toolbar) {
      const finalMode = newMode ?? "tree";
      console.log("[MetaGrouperView] Setting toolbar display mode to:", finalMode);
      this.toolbar.setDisplayMode(finalMode);
    }

    // Save view state (for expanded nodes, etc.)
    this.saveViewState();
  }

  /**
   * Build and render tree based on current view configuration
   */
  private buildAndRenderTree(container: HTMLElement): void {
    if (!this.treeBuilder || !this.treeComponent) {
      return;
    }

    // Get the current view configuration
    const savedViewConfig = this.plugin.settings.savedViews.find(
      (v) => v.name === this.currentViewName
    );

    if (!savedViewConfig) {
      // Fallback to default view if current view not found
      container.createDiv("metagrouper-error", (el) => {
        el.textContent = `View "${this.currentViewName}" not found. Please check your settings.`;
      });
      return;
    }

    // Use working copy if it exists, otherwise create a fresh copy from settings
    // The working copy preserves toolbar filter modifications
    if (!this.workingViewConfig) {
      // Create a deep copy for this render session
      this.workingViewConfig = JSON.parse(JSON.stringify(savedViewConfig));
    }

    const viewConfig = this.workingViewConfig;
    if (!viewConfig) {
      // This should never happen, but satisfy TypeScript
      return;
    }

    // Apply level color mode to the tree container
    if (viewConfig.levelColorMode && viewConfig.levelColorMode !== "none") {
      container.setAttribute("data-level-color-mode", viewConfig.levelColorMode);
    } else {
      container.removeAttribute("data-level-color-mode");
    }

    // Set data attribute if file color is configured (independent of level color mode)
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

    // Build tree based on display mode
    const viewState = this.plugin.settings.viewStates[this.currentViewName];
    const effectiveDisplayMode = viewState?.displayModeOverride ?? viewConfig.displayMode ?? "tree";

    let tree: TreeNode;
    if (effectiveDisplayMode === "flat") {
      tree = this.treeBuilder.buildFlattenedTree(viewConfig, viewState);
    } else {
      // TreeBuilder will internally optimize for simple tag hierarchies (depth=-1)
      tree = this.treeBuilder.buildFromHierarchy(viewConfig, viewState);
    }

    // Update toolbar with unique file count and current view config
    if (this.toolbar) {
      const uniqueFileCount = this.countUniqueFiles(tree);
      this.toolbar.setFileCount(uniqueFileCount);
      this.toolbar.setCurrentViewConfig(viewConfig);
    }

    // Render tree
    this.treeComponent.render(tree, container);
  }

  /**
   * Count unique files in the tree (same file can appear multiple times)
   */
  private countUniqueFiles(tree: TreeNode): number {
    const uniqueFiles = new Set<string>();

    const traverse = (node: TreeNode) => {
      if (node.type === "file" && node.files && node.files.length > 0) {
        // File nodes have a single file in their files array
        uniqueFiles.add(node.files[0].path);
      }
      if (node.children) {
        node.children.forEach(child => traverse(child));
      }
    };

    traverse(tree);
    return uniqueFiles.size;
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
      ".metagrouper-content"
    ) as HTMLElement;
    if (container) {
      this.buildAndRenderTree(container);
    }
  }

  /**
   * Public method to refresh the tree (called from plugin when settings change)
   */
  refresh(): void {
    // Reset working config to pick up settings changes
    this.workingViewConfig = null;

    // Clear toolbar's stored original filter values so fresh ones can be stored
    if (this.toolbar) {
      this.toolbar.clearOriginalFilterValues();
    }

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
      ".metagrouper-content"
    ) as HTMLElement;

    // Get existing state to preserve displayModeOverride
    const existingState = this.plugin.settings.viewStates[this.currentViewName];
    
    const state: ViewState = {
      expandedNodes: Array.from(this.treeComponent.getExpandedNodes()),
      showFiles: this.treeComponent.getFileVisibility(),
      fileSortMode: this.treeComponent.getFileSortMode(),
      scrollPosition: treeContent?.scrollTop ?? 0,
      // Preserve displayModeOverride if it exists
      displayModeOverride: existingState?.displayModeOverride,
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
          ".metagrouper-content"
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
        `[MetaGrouper] Cannot build search query: view "${this.currentViewName}" not found`
      );
      return;
    }

    // Build the search query
    const queryBuilder = new SearchQueryBuilder(viewConfig);
    const query = queryBuilder.buildQuery(node);

    if (!query) {
      console.warn("[MetaGrouper] No search query generated for node:", node);
      return;
    }

    console.log("[MetaGrouper] Opening search with query:", query);

    // Open the search view with the query
    this.obsidianSearch.openSearchWithQuery(query);
  }
}