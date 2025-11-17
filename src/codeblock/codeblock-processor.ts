import { App, MarkdownPostProcessorContext } from "obsidian";
import TagTreePlugin from "../main";
import { VaultIndexer } from "../indexer/vault-indexer";
import { TreeBuilder } from "../tree/tree-builder";
import { TreeComponent } from "../components/tree-component";
import { HierarchyConfig } from "../types/hierarchy-config";

/**
 * Configuration options for rendering a tree in a codeblock
 */
export interface CodeblockConfig {
  // Option 1: Reference a saved view by name
  view?: string;

  // Rendering options
  interactive?: boolean; // Default: true
  format?: "details" | "list"; // Default: "details"
  expanded?: number; // Default expansion depth
  showFiles?: boolean; // Show file nodes, default: true
}

/**
 * TagTreeCodeblockProcessor - Handles rendering of tagtree codeblocks
 *
 * Supports the following syntax:
 * ```tagtree
 * view: "Projects by Status"
 * interactive: true
 * format: details
 * expanded: 2
 * showFiles: true
 * ```
 */
export class TagTreeCodeblockProcessor {
  private app: App;
  private plugin: TagTreePlugin;

  constructor(app: App, plugin: TagTreePlugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Parse the codeblock source into a configuration object
   */
  parseConfig(source: string): CodeblockConfig {
    const config: CodeblockConfig = {
      interactive: true,
      format: "details",
      expanded: 1,
      showFiles: true,
    };

    // Parse YAML-like syntax
    const lines = source.trim().split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue; // Skip empty lines and comments
      }

      // Parse key: value pairs
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // Remove quotes from string values
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Parse based on key
      switch (key.toLowerCase()) {
        case "view":
          config.view = value;
          break;
        case "interactive":
          config.interactive = value.toLowerCase() === "true";
          break;
        case "format":
          if (value === "details" || value === "list") {
            config.format = value;
          }
          break;
        case "expanded":
          const depth = parseInt(value, 10);
          if (!isNaN(depth)) {
            config.expanded = depth;
          }
          break;
        case "showfiles":
        case "show_files":
          config.showFiles = value.toLowerCase() === "true";
          break;
      }
    }

    return config;
  }

  /**
   * Render the tree based on the configuration
   */
  async render(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    try {
      // Parse configuration
      const config = this.parseConfig(source);

      // Get hierarchy configuration
      let hierarchyConfig: HierarchyConfig | undefined;

      if (config.view) {
        // Look up saved view by name
        hierarchyConfig = this.plugin.settings.savedViews.find(
          (v) => v.name === config.view
        );

        if (!hierarchyConfig) {
          this.renderError(
            el,
            `View "${config.view}" not found. Available views: ${this.plugin.settings.savedViews.map((v) => v.name).join(", ")}`
          );
          return;
        }
      } else {
        this.renderError(
          el,
          'No view specified. Use "view: ViewName" to reference a saved view.'
        );
        return;
      }

      // Create indexer and builder
      const indexer = new VaultIndexer(this.app);
      await indexer.initialize();

      const builder = new TreeBuilder(indexer);

      // Build tree from hierarchy configuration
      // TreeBuilder will internally optimize for simple tag hierarchies (depth=-1)
      const tree = builder.buildFromHierarchy(hierarchyConfig);

      // Create a container for the tree
      const treeContainer = el.createDiv("tag-tree-codeblock");

      // Add data attributes for styling
      treeContainer.dataset.interactive = String(config.interactive);
      treeContainer.dataset.format = config.format;

      // Render based on format
      if (config.format === "details") {
        await this.renderDetailsFormat(
          tree,
          treeContainer,
          config,
          hierarchyConfig
        );
      } else {
        await this.renderListFormat(
          tree,
          treeContainer,
          config,
          hierarchyConfig
        );
      }
    } catch (error) {
      console.error("[TagTree] Error rendering codeblock:", error);
      const message = error instanceof Error ? error.message : String(error);
      this.renderError(el, `Error rendering tree: ${message}`);
    }
  }

  /**
   * Render using the details format (collapsible HTML with <details> tags)
   */
  private async renderDetailsFormat(
    tree: any,
    container: HTMLElement,
    config: CodeblockConfig,
    hierarchyConfig: HierarchyConfig
  ): Promise<void> {
    // Use TreeComponent for rendering
    const treeComponent = new TreeComponent(this.app);

    // Configure the tree component
    treeComponent.setDefaultExpandDepth(config.expanded || 1);
    treeComponent.setFileVisibility(config.showFiles ?? true);

    // Render the tree
    treeComponent.render(tree, container);

    // If non-interactive, disable click handlers
    if (!config.interactive) {
      this.disableInteractivity(container);
    }
  }

  /**
   * Render using the list format (plain nested <ul> lists)
   */
  private async renderListFormat(
    tree: any,
    container: HTMLElement,
    config: CodeblockConfig,
    hierarchyConfig: HierarchyConfig
  ): Promise<void> {
    // Create a simple nested list representation
    const ul = container.createEl("ul", { cls: "tag-tree-list" });
    this.renderNodeAsList(tree, ul, config);
  }

  /**
   * Render a node as a list item
   */
  private renderNodeAsList(
    node: any,
    parent: HTMLElement,
    config: CodeblockConfig,
    depth: number = 0
  ): void {
    // Skip root node
    if (node.id === "root") {
      node.children.forEach((child: any) => {
        this.renderNodeAsList(child, parent, config, depth);
      });
      return;
    }

    // Skip file nodes if showFiles is false
    if (!config.showFiles && node.type === "file") {
      return;
    }

    const li = parent.createEl("li");

    // Create node content
    const span = li.createEl("span", { cls: "tag-tree-node-name" });

    if (node.type === "file" && node.files[0]) {
      // Render file as a link
      const link = span.createEl("a", {
        cls: "internal-link",
        href: node.files[0].path,
      });
      link.textContent = node.name;

      if (config.interactive) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const leaf = this.app.workspace.getLeaf(false);
          leaf.openFile(node.files[0]);
        });
      }
    } else {
      // Render tag/group node
      span.textContent = node.name;
      if (node.fileCount > 0) {
        span.createEl("span", {
          cls: "tag-tree-count",
          text: ` (${node.fileCount})`,
        });
      }
    }

    // Render children
    if (node.children && node.children.length > 0) {
      // Only render if within expanded depth
      if (depth < (config.expanded || 1)) {
        const childUl = li.createEl("ul");
        node.children.forEach((child: any) => {
          this.renderNodeAsList(child, childUl, config, depth + 1);
        });
      }
    }
  }

  /**
   * Disable interactive elements in a container
   */
  private disableInteractivity(container: HTMLElement): void {
    // Remove all click event listeners by replacing elements with clones
    const clickableElements = container.querySelectorAll(
      ".tree-node-header, .tree-collapse-icon, a"
    );

    clickableElements.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.style.cursor = "default";
        parent.replaceChild(clone, el);
      }
    });

    // Add non-interactive class for CSS styling
    container.addClass("tag-tree-non-interactive");
  }

  /**
   * Render an error message
   */
  private renderError(container: HTMLElement, message: string): void {
    const errorDiv = container.createDiv("tag-tree-codeblock-error");
    errorDiv.createEl("strong", { text: "Tag Tree Error: " });
    errorDiv.createEl("span", { text: message });
  }
}
