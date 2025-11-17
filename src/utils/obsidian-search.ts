import { App } from "obsidian";

/**
 * Utilities for interacting with Obsidian's search functionality
 */
export class ObsidianSearch {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Open Obsidian's search view with a specific query
   *
   * This method:
   * 1. Opens the global search view (if not already open)
   * 2. Sets the search query
   * 3. Executes the search
   */
  async openSearchWithQuery(query: string): Promise<void> {
    try {
      // Method 1: Try to use the internal search plugin
      // This is the most reliable way to open search with a query
      const searchPlugin = (this.app as any).internalPlugins?.plugins?.[
        "global-search"
      ];

      if (searchPlugin && searchPlugin.enabled) {
        const searchInstance = searchPlugin.instance;

        // Open the search view
        const searchLeaf = this.app.workspace.getLeavesOfType("search")[0];
        if (searchLeaf) {
          // Search view is already open, reveal it
          this.app.workspace.revealLeaf(searchLeaf);
        } else {
          // Open a new search view
          const rightLeaf = this.app.workspace.getRightLeaf(false);
          if (rightLeaf) {
            await rightLeaf.setViewState({
              type: "search",
              active: true,
            });
          }
        }

        // Set the search query
        // The search instance has different methods depending on Obsidian version
        if (searchInstance.openGlobalSearch) {
          // Newer API
          searchInstance.openGlobalSearch(query);
        } else if (searchInstance.searchComponent) {
          // Older API - access the search component directly
          const searchComponent = searchInstance.searchComponent;
          if (searchComponent) {
            searchComponent.setValue(query);
            searchComponent.onSearchChange();
          }
        } else {
          // Fallback: try to set the DOM input value
          setTimeout(() => {
            const searchInput = document.querySelector(
              ".workspace-leaf.mod-active .search-input-container input"
            ) as HTMLInputElement;
            if (searchInput) {
              searchInput.value = query;
              searchInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }, 100);
        }
      } else {
        // Fallback: Execute the command to open search
        // Then try to set the query via DOM manipulation
        (this.app as any).commands?.executeCommandById("global-search:open");

        // Wait a bit for the search view to open, then set the query
        setTimeout(() => {
          const searchInput = document.querySelector(
            ".workspace-leaf.mod-active .search-input-container input"
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.value = query;
            searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, 100);
      }
    } catch (error) {
      console.error("[TagTree] Error opening search with query:", error);
      // Fallback: just open the search view
      (this.app as any).commands?.executeCommandById("global-search:open");
    }
  }
}
