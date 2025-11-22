import { App, TFile, Menu, setIcon } from "obsidian";
import { TreeNode } from "../types/tree-node";
import { SortMode, FileSortMode } from "../types/view-state";

/**
 * TreeComponent - Renders and manages the collapsible tree UI
 *
 * Responsibilities:
 * - Render tree nodes with collapse/expand icons
 * - Handle click events for navigation and toggling
 * - Maintain UI state (expanded/collapsed nodes, file visibility, sort mode)
 * - Support smart partial DOM updates
 */
export class TreeComponent {
  private app: App;
  private container!: HTMLElement;
  private currentTree: TreeNode | null = null;

  // UI state
  private expandedNodes: Set<string> = new Set();
  private showFiles: boolean = true;
  private sortMode: SortMode = "alpha-asc"; // Legacy, kept for compatibility
  private fileSortMode: FileSortMode = "alpha-asc";
  private hasInitializedExpansion: boolean = false;

  // Configuration
  private defaultExpandDepth: number = 1;

  // DOM element cache for smart updates
  private nodeElements: Map<string, HTMLElement> = new Map();

  // State change callback
  private onStateChange?: () => void;

  // Node search callback (triggered by Ctrl+click or Ctrl+Enter)
  private onNodeSearch?: (node: TreeNode) => void;

  // Node sort change callback (triggered by right-click context menu)
  private onNodeSortChange?: (node: TreeNode, sortMode: SortMode) => void;

  // Keyboard navigation state
  private focusedNodeId: string | null = null;
  private flatNodeList: TreeNode[] = [];

  constructor(
    app: App,
    onStateChange?: () => void,
    onNodeSearch?: (node: TreeNode) => void,
    onNodeSortChange?: (node: TreeNode, sortMode: SortMode) => void
  ) {
    this.app = app;
    this.onStateChange = onStateChange;
    this.onNodeSearch = onNodeSearch;
    this.onNodeSortChange = onNodeSortChange;
  }

  /**
   * Render the entire tree
   */
  render(tree: TreeNode, container: HTMLElement): void {
    this.currentTree = tree;
    this.container = container;

    // Clear container
    container.empty();

    // Create main tree container
    const treeContainer = container.createDiv("metagrouper-container");

    // Set up keyboard navigation
    this.setupKeyboardNavigation(treeContainer);

    // Initialize default expanded state on first render only
    if (!this.hasInitializedExpansion && this.defaultExpandDepth > 0) {
      this.initializeDefaultExpansion(tree);
      this.hasInitializedExpansion = true;
    }

    // Render tree (skip root node, render its children)
    if (tree.id === "root") {
      tree.children.forEach((child) => {
        this.renderNodeRecursive(child, treeContainer);
      });
    } else {
      this.renderNodeRecursive(tree, treeContainer);
    }

    // Build flat node list for keyboard navigation
    this.buildFlatNodeList();
  }

  /**
   * Initialize default expanded state based on depth
   */
  private initializeDefaultExpansion(node: TreeNode): void {
    // Expand nodes up to (and including) the default depth
    // node.depth represents the actual depth of the node in the tree
    // Example: defaultExpandDepth = 1 means expand nodes at depth 0 and 1
    if (node.depth <= this.defaultExpandDepth && node.children.length > 0) {
      this.expandedNodes.add(node.id);
    }

    // Recursively process all children
    node.children.forEach((child) => {
      this.initializeDefaultExpansion(child);
    });
  }

  /**
   * Render a single node and its children recursively
   */
  private renderNodeRecursive(
    node: TreeNode,
    parent: HTMLElement,
    skipFiles: boolean = false
  ): HTMLElement {
    // Skip file nodes if files are hidden
    if (!this.showFiles && node.type === "file") {
      return parent;
    }

    // Create node element
    const nodeEl = parent.createDiv("tree-node");
    nodeEl.dataset.nodeId = node.id;
    nodeEl.dataset.nodeType = node.type;

    // Add hierarchy level index for styling (but NOT for file nodes and NOT for flattened nodes)
    if (node.metadata?.levelIndex !== undefined && node.type !== "file" && !node.metadata?.flattenedPath) {
      nodeEl.dataset.levelIndex = String(node.metadata.levelIndex);
    }

    // Store in cache for smart updates
    this.nodeElements.set(node.id, nodeEl);

    // Add collapsed class if not expanded
    const isExpanded = this.isExpanded(node.id);
    if (!isExpanded) {
      nodeEl.addClass("collapsed");
    }

    // Create header
    const header = nodeEl.createDiv("tree-node-header");

    // Make header focusable for keyboard navigation
    header.setAttribute("tabindex", "0");
    header.setAttribute("role", "treeitem");
    header.dataset.focusNodeId = node.id;

    // Check if node has visible children (excluding files if they're hidden)
    const hasVisibleChildren = this.hasVisibleChildren(node);

    // Add collapse icon (only if has visible children)
    if (hasVisibleChildren) {
      const collapseIcon = header.createSpan("tree-collapse-icon");

      // Use Obsidian's built-in icons
      if (isExpanded) {
        setIcon(collapseIcon, "chevron-down");
      } else {
        setIcon(collapseIcon, "chevron-right");
      }

      // Click handler for collapse icon
      collapseIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleNode(node.id);
      });
    } else {
      // Placeholder to maintain alignment
      header.createSpan("tree-collapse-icon-placeholder");
    }

    // Add node icon based on type (skip for flattened nodes - they use segment icons)
    if (!node.metadata?.flattenedPath) {
      const nodeIcon = header.createSpan("tree-node-icon");
      if (node.type === "file") {
        setIcon(nodeIcon, "file");
      } else if (node.type === "tag") {
        setIcon(nodeIcon, "tags");
      } else if (node.type === "property-group") {
        setIcon(nodeIcon, "list");
      }
    }

    // Add node name (with support for flattened segments)
    const nameEl = header.createSpan("tree-node-name");

    // Check if this is a flattened node with segments
    if (node.metadata?.flattenedPath && node.metadata.flattenedPath.length > 0) {
      // Render each segment with its own color
      node.metadata.flattenedPath.forEach((segment, index) => {
        // Add icon for each segment in icon mode (use simple dot)
        const iconEl = nameEl.createSpan("tree-node-segment-icon");
        iconEl.dataset.levelIndex = String(segment.levelIndex);
        iconEl.textContent = "•"; // Simple dot instead of complex icons

        const segmentEl = nameEl.createSpan("tree-node-name-segment");
        segmentEl.textContent = segment.segment;

        // Add level index for CSS styling
        segmentEl.dataset.levelIndex = String(segment.levelIndex);

        // Add separator if not the last segment
        if (index < node.metadata!.flattenedPath!.length - 1) {
          const separatorEl = nameEl.createSpan("tree-node-name-separator");
          separatorEl.textContent = "; ";
        }
      });
    } else {
      // Regular node name rendering
      nameEl.textContent = node.name;
    }

    // Add file count (for non-file nodes)
    if (node.type !== "file" && node.fileCount > 0) {
      const countEl = header.createSpan("tree-node-count");
      countEl.textContent = `(${node.fileCount})`;
    }

    // Add tooltip with additional info
    this.addTooltip(header, node);

    // Click handler for header (toggle, open file, or search)
    header.addEventListener("click", (e) => {
      // Ctrl+click triggers search for tag and property nodes
      if (e.ctrlKey || e.metaKey) {
        if (node.type !== "file" && this.onNodeSearch) {
          e.preventDefault();
          e.stopPropagation();
          this.onNodeSearch(node);
          return;
        }
      }

      // Regular click behavior
      if (node.type === "file" && node.files[0]) {
        this.openFile(node.files[0]);
      } else if (hasVisibleChildren) {
        this.toggleNode(node.id);
      }
    });

    // Context menu handler for tag/property nodes (for sort mode change)
    if (node.type !== "file" && this.onNodeSortChange) {
      header.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showSortContextMenu(e, node);
      });
    }

    // Render children if expanded
    if (isExpanded && hasVisibleChildren) {
      const childrenContainer = nodeEl.createDiv("tree-node-children");

      node.children.forEach((child) => {
        this.renderNodeRecursive(child, childrenContainer);
      });
    }

    return nodeEl;
  }

  /**
   * Check if a node has visible children (considering file visibility setting)
   */
  private hasVisibleChildren(node: TreeNode): boolean {
    if (node.children.length === 0) {
      return false;
    }

    // If showing files, any children count as visible
    if (this.showFiles) {
      return true;
    }

    // If not showing files, check if there are any non-file children
    return node.children.some(child => child.type !== "file");
  }

  /**
   * Add tooltip to a node header
   */
  private addTooltip(header: HTMLElement, node: TreeNode): void {
    let tooltipText = "";

    if (node.type === "file") {
      tooltipText = node.files[0]?.path || node.name;
    } else if (node.metadata?.tagPath) {
      tooltipText = `Tag: #${node.metadata.tagPath}\n${node.fileCount} file(s)`;
    } else if (node.metadata?.propertyKey) {
      tooltipText = `Property: ${node.metadata.propertyKey} = ${node.metadata.propertyValue}\n${node.fileCount} file(s)`;
    } else {
      tooltipText = `${node.name}\n${node.fileCount} file(s)`;
    }

    // Use only native browser tooltip (title attribute)
    header.setAttribute("title", tooltipText);
  }

  /**
   * Toggle a node's expanded/collapsed state (smart update)
   */
  toggleNode(nodeId: string): void {
    // Toggle state
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }

    // Smart update: only update the affected node
    this.updateNodeElement(nodeId);

    // Rebuild flat node list for keyboard navigation
    this.buildFlatNodeList();

    // Notify state change
    this.onStateChange?.();
  }

  /**
   * Update a single node element (smart partial DOM update)
   */
  private updateNodeElement(nodeId: string): void {
    const nodeEl = this.nodeElements.get(nodeId);
    if (!nodeEl || !this.currentTree) {
      return;
    }

    const isExpanded = this.isExpanded(nodeId);

    // Update collapsed class
    if (isExpanded) {
      nodeEl.removeClass("collapsed");
    } else {
      nodeEl.addClass("collapsed");
    }

    // Update collapse icon
    const collapseIcon = nodeEl.querySelector(
      ".tree-collapse-icon"
    ) as HTMLElement;
    if (collapseIcon) {
      collapseIcon.empty();
      if (isExpanded) {
        setIcon(collapseIcon, "chevron-down");
      } else {
        setIcon(collapseIcon, "chevron-right");
      }
    }

    // Find the node in the tree
    const node = this.findNodeById(this.currentTree, nodeId);
    if (!node) {
      return;
    }

    // Get or create children container
    let childrenContainer = nodeEl.querySelector(
      ".tree-node-children"
    ) as HTMLElement;

    if (isExpanded && node.children.length > 0) {
      // Expand: render children if not already rendered
      if (!childrenContainer) {
        childrenContainer = nodeEl.createDiv("tree-node-children");
        node.children.forEach((child) => {
          this.renderNodeRecursive(child, childrenContainer);
        });
      }
    } else {
      // Collapse: remove children container
      if (childrenContainer) {
        // Clean up cache for removed nodes
        this.removeNodeAndDescendantsFromCache(node);
        childrenContainer.remove();
      }
    }
  }

  /**
   * Remove a node and its descendants from the element cache
   */
  private removeNodeAndDescendantsFromCache(node: TreeNode): void {
    node.children.forEach((child) => {
      this.nodeElements.delete(child.id);
      this.removeNodeAndDescendantsFromCache(child);
    });
  }

  /**
   * Find a node by ID in the tree
   */
  private findNodeById(node: TreeNode, id: string): TreeNode | null {
    if (node.id === id) {
      return node;
    }

    for (const child of node.children) {
      const found = this.findNodeById(child, id);
      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * Check if a node is expanded
   */
  private isExpanded(nodeId: string): boolean {
    return this.expandedNodes.has(nodeId);
  }

  /**
   * Open a file in the editor
   */
  private async openFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  /**
   * Expand all nodes
   */
  expandAll(): void {
    if (!this.currentTree) return;

    this.expandAllRecursive(this.currentTree);
    this.render(this.currentTree, this.container);
  }

  /**
   * Recursively expand all nodes
   */
  private expandAllRecursive(node: TreeNode): void {
    if (node.children.length > 0) {
      this.expandedNodes.add(node.id);
      node.children.forEach((child) => this.expandAllRecursive(child));
    }
  }

  /**
   * Collapse all nodes
   */
  collapseAll(): void {
    this.expandedNodes.clear();
    if (this.currentTree) {
      this.render(this.currentTree, this.container);
    }
  }

  /**
   * Expand to a specific depth
   */
  expandToDepth(depth: number): void {
    if (!this.currentTree) return;

    this.expandedNodes.clear();
    this.expandToDepthRecursive(this.currentTree, depth);
    this.render(this.currentTree, this.container);
  }

  /**
   * Recursively expand nodes up to a specific depth
   */
  private expandToDepthRecursive(node: TreeNode, targetDepth: number): void {
    // Expand nodes up to (and including) the target depth
    if (node.depth <= targetDepth && node.children.length > 0) {
      this.expandedNodes.add(node.id);
    }

    // Recursively process all children
    node.children.forEach((child) =>
      this.expandToDepthRecursive(child, targetDepth)
    );
  }

  /**
   * Toggle file visibility
   */
  toggleFileVisibility(): void {
    this.showFiles = !this.showFiles;
    if (this.currentTree) {
      this.render(this.currentTree, this.container);
    }
    // Notify state change
    this.onStateChange?.();
  }

  /**
   * Set file visibility
   */
  setFileVisibility(show: boolean): void {
    if (this.showFiles !== show) {
      this.showFiles = show;
      if (this.currentTree) {
        this.render(this.currentTree, this.container);
      }
      // Notify state change
      this.onStateChange?.();
    }
  }

  /**
   * Get file visibility state
   */
  getFileVisibility(): boolean {
    return this.showFiles;
  }

  /**
   * Set default expansion depth
   */
  setDefaultExpandDepth(depth: number): void {
    this.defaultExpandDepth = depth;
  }

  /**
   * Get expanded nodes (for state persistence)
   */
  getExpandedNodes(): Set<string> {
    return new Set(this.expandedNodes);
  }

  /**
   * Set expanded nodes (for state restoration)
   */
  setExpandedNodes(nodes: Set<string>): void {
    this.expandedNodes = nodes;
    if (this.currentTree) {
      this.render(this.currentTree, this.container);
    }
  }

  /**
   * Reset expansion state (used when switching display modes)
   */
  resetExpansionState(): void {
    this.expandedNodes.clear();
    this.hasInitializedExpansion = false;
  }

  /**
   * Get current sort mode (for state persistence)
   * LEGACY: Kept for compatibility
   */
  getSortMode(): SortMode {
    return this.sortMode;
  }

  /**
   * Set sort mode (for state restoration)
   * LEGACY: Kept for compatibility
   */
  setSortMode(mode: SortMode): void {
    if (this.sortMode !== mode) {
      this.sortMode = mode;
      // Notify state change
      this.onStateChange?.();
    }
  }

  /**
   * Get current file sort mode (for state persistence)
   */
  getFileSortMode(): FileSortMode {
    return this.fileSortMode;
  }

  /**
   * Set file sort mode (for state restoration)
   */
  setFileSortMode(mode: FileSortMode): void {
    if (this.fileSortMode !== mode) {
      this.fileSortMode = mode;
      // Notify state change
      this.onStateChange?.();
    }
  }

  /**
   * Set up keyboard navigation for the tree
   */
  private setupKeyboardNavigation(container: HTMLElement): void {
    container.addEventListener("keydown", (e) => {
      this.handleKeyDown(e);
    });

    // Handle focus events to track focused node
    container.addEventListener("focusin", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("tree-node-header")) {
        this.focusedNodeId = target.dataset.focusNodeId || null;
      }
    });
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.focusedNodeId) return;

    const currentIndex = this.flatNodeList.findIndex(
      (node) => node.id === this.focusedNodeId
    );
    if (currentIndex === -1) return;

    const currentNode = this.flatNodeList[currentIndex];

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.focusNextNode(currentIndex);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.focusPreviousNode(currentIndex);
        break;
      case "ArrowRight":
        e.preventDefault();
        this.handleRightArrow(currentNode);
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.handleLeftArrow(currentNode);
        break;
      case "Enter":
        e.preventDefault();
        this.handleEnter(currentNode, e.ctrlKey || e.metaKey);
        break;
      case " ": // Space
        e.preventDefault();
        this.handleSpace(currentNode, e.ctrlKey || e.metaKey);
        break;
      case "Home":
        e.preventDefault();
        this.focusFirstNode();
        break;
      case "End":
        e.preventDefault();
        this.focusLastNode();
        break;
    }
  }

  /**
   * Build a flat list of all visible nodes for keyboard navigation
   */
  private buildFlatNodeList(): void {
    this.flatNodeList = [];
    if (!this.currentTree) return;

    const addNode = (node: TreeNode) => {
      // Skip root node
      if (node.id === "root") {
        node.children.forEach(addNode);
        return;
      }

      // Skip file nodes if files are hidden
      if (!this.showFiles && node.type === "file") {
        return;
      }

      this.flatNodeList.push(node);

      // Add children if node is expanded
      if (this.isExpanded(node.id)) {
        node.children.forEach(addNode);
      }
    };

    addNode(this.currentTree);
  }

  /**
   * Focus the next node in the flat list
   */
  private focusNextNode(currentIndex: number): void {
    if (currentIndex < this.flatNodeList.length - 1) {
      const nextNode = this.flatNodeList[currentIndex + 1];
      this.focusNode(nextNode.id);
    }
  }

  /**
   * Focus the previous node in the flat list
   */
  private focusPreviousNode(currentIndex: number): void {
    if (currentIndex > 0) {
      const prevNode = this.flatNodeList[currentIndex - 1];
      this.focusNode(prevNode.id);
    }
  }

  /**
   * Focus the first node
   */
  private focusFirstNode(): void {
    if (this.flatNodeList.length > 0) {
      this.focusNode(this.flatNodeList[0].id);
    }
  }

  /**
   * Focus the last node
   */
  private focusLastNode(): void {
    if (this.flatNodeList.length > 0) {
      this.focusNode(this.flatNodeList[this.flatNodeList.length - 1].id);
    }
  }

  /**
   * Focus a specific node by ID
   */
  private focusNode(nodeId: string): void {
    const nodeEl = this.nodeElements.get(nodeId);
    if (!nodeEl) return;

    const header = nodeEl.querySelector(".tree-node-header") as HTMLElement;
    if (header) {
      header.focus();
      this.focusedNodeId = nodeId;

      // Scroll into view if needed
      header.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }

  /**
   * Handle right arrow key (expand node)
   */
  private handleRightArrow(node: TreeNode): void {
    if (node.children.length > 0) {
      if (!this.isExpanded(node.id)) {
        this.toggleNode(node.id);
      } else {
        // If already expanded, move to first child
        const currentIndex = this.flatNodeList.findIndex(
          (n) => n.id === node.id
        );
        if (currentIndex < this.flatNodeList.length - 1) {
          this.focusNextNode(currentIndex);
        }
      }
    }
  }

  /**
   * Handle left arrow key (collapse node or move to parent)
   */
  private handleLeftArrow(node: TreeNode): void {
    if (this.isExpanded(node.id) && node.children.length > 0) {
      // Collapse if expanded
      this.toggleNode(node.id);
    } else if (node.parent) {
      // Move to parent if not expanded
      this.focusNode(node.parent.id);
    }
  }

  /**
   * Handle Enter key (open file, toggle folder, or search with Ctrl)
   */
  private handleEnter(node: TreeNode, ctrlKey: boolean = false): void {
    // Ctrl+Enter triggers search for tag and property nodes
    if (ctrlKey && node.type !== "file" && this.onNodeSearch) {
      this.onNodeSearch(node);
      return;
    }

    // Regular Enter behavior
    if (node.type === "file" && node.files[0]) {
      this.openFile(node.files[0]);
    } else if (node.children.length > 0) {
      this.toggleNode(node.id);
    }
  }

  /**
   * Handle Space key (toggle expand/collapse, or search with Ctrl)
   */
  private handleSpace(node: TreeNode, ctrlKey: boolean = false): void {
    // Ctrl+Space triggers search for tag and property nodes
    if (ctrlKey && node.type !== "file" && this.onNodeSearch) {
      this.onNodeSearch(node);
      return;
    }

    // Regular Space behavior
    if (node.children.length > 0) {
      this.toggleNode(node.id);
    }
  }

  /**
   * Show context menu for sorting a node's children
   */
  private showSortContextMenu(e: MouseEvent, node: TreeNode): void {
    if (!this.onNodeSortChange) {
      return;
    }

    const menu = new Menu();

    // Sort mode options
    const sortModes: Array<{ mode: SortMode; label: string }> = [
      { mode: "alpha-asc", label: "A → Z" },
      { mode: "alpha-desc", label: "Z → A" },
      { mode: "count-desc", label: "Count (high to low)" },
      { mode: "count-asc", label: "Count (low to high)" },
      { mode: "none", label: "Unsorted" },
    ];

    // Add section header
    menu.addItem((item) => {
      item
        .setTitle("Sort children by:")
        .setDisabled(true);
    });

    menu.addSeparator();

    // Add sort mode options
    sortModes.forEach(({ mode, label }) => {
      menu.addItem((item) => {
        item
          .setTitle(label)
          .onClick(() => {
            this.onNodeSortChange!(node, mode);
          });
      });
    });

    // Show the menu at mouse position
    menu.showAtMouseEvent(e);
  }
}
