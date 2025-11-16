import { TFile } from "obsidian";
import { VaultIndexer } from "../indexer/vault-indexer";
import { TreeNode, createTagNode, createFileNode } from "../types/tree-node";
import { SortMode } from "../types/view-state";

/**
 * TreeBuilder - Transforms flat tag index into hierarchical tree structure
 *
 * Responsibilities:
 * - Transform flat tag index into hierarchical tree structure
 * - Support filtering by root tag
 * - Generate tree nodes with metadata (file count, children)
 * - Sort nodes according to specified sort mode
 */
export class TreeBuilder {
  constructor(private indexer: VaultIndexer) {}

  /**
   * Build a tree from nested tags
   *
   * @param rootTag - Optional root tag to filter by (e.g., "project" will show only tags under #project)
   * @param sortMode - Sort mode to apply to tree nodes (default: "alpha-asc")
   * @returns Root tree node with hierarchical structure
   */
  buildFromTags(rootTag?: string, sortMode: SortMode = "alpha-asc"): TreeNode {
    // Get all tags (filtered by root if specified)
    const allTags = rootTag
      ? this.indexer.getNestedTagsUnder(rootTag)
      : this.indexer.getAllTags();

    // Create the root node
    const root: TreeNode = {
      id: "root",
      name: "Root",
      type: "tag",
      children: [],
      depth: 0,
      files: [],
      fileCount: 0,
    };

    // Build a map of tag path -> TreeNode for easy lookup
    const nodeMap = new Map<string, TreeNode>();
    nodeMap.set("root", root);

    // Sort tags by depth (parents before children) to ensure parents exist
    const sortedTags = allTags.sort((a, b) => {
      const depthA = a.split("/").length;
      const depthB = b.split("/").length;
      return depthA - depthB;
    });

    // Create tag nodes
    for (const tag of sortedTags) {
      const segments = tag.split("/");
      const depth = segments.length;

      // Create the tag node (without files yet)
      const node = createTagNode(tag, [], depth);
      nodeMap.set(tag, node);

      // Find parent node
      const parentTag = segments.slice(0, -1).join("/");
      const parent = parentTag ? nodeMap.get(parentTag) : root;

      if (parent) {
        parent.children.push(node);
        node.parent = parent;
      }
    }

    // Add file nodes to leaf tag nodes
    this.addFileNodes(nodeMap);

    // Sort all children according to sort mode
    this.sortTreeRecursive(root, sortMode);

    // Calculate aggregate file counts
    this.calculateFileCounts(root);

    return root;
  }

  /**
   * Add file nodes as children to tag nodes
   * Files are added to the deepest (most specific) tag they have
   */
  private addFileNodes(nodeMap: Map<string, TreeNode>): void {
    // For each tag node, get files that have exactly that tag
    for (const [tagPath, node] of nodeMap.entries()) {
      if (tagPath === "root") continue;

      // Get files with this specific tag
      const filesWithTag = this.indexer.getFilesWithTag(tagPath);

      // We need to find files that have this tag as their MOST SPECIFIC tag
      // (i.e., they don't have a more nested version of this tag)
      const filesToAdd: TFile[] = [];

      for (const file of filesWithTag) {
        const fileTags = this.indexer.getFileTags(file);

        // Find the most specific tag for this file that starts with tagPath
        let mostSpecificTag = tagPath;
        for (const fileTag of fileTags) {
          if (
            fileTag.startsWith(tagPath) &&
            fileTag.length > mostSpecificTag.length
          ) {
            mostSpecificTag = fileTag;
          }
        }

        // If this tag is the most specific, add the file here
        if (mostSpecificTag === tagPath) {
          filesToAdd.push(file);
        }
      }

      // Add file nodes as children
      for (const file of filesToAdd) {
        const fileNode = createFileNode(file, node.depth + 1);
        fileNode.parent = node;
        node.children.push(fileNode);
      }
    }
  }

  /**
   * Calculate aggregate file counts recursively
   * Each node's fileCount includes files from all descendants
   *
   * @param node - Node to calculate counts for
   * @returns Total file count for this node and all descendants
   */
  private calculateFileCounts(node: TreeNode): number {
    // If this is a file node, return 1
    if (node.type === "file") {
      node.fileCount = 1;
      return 1;
    }

    let total = 0;

    // Count files from children (recursively)
    for (const child of node.children) {
      total += this.calculateFileCounts(child);
    }

    // Update the node's file count
    node.fileCount = total;

    return total;
  }

  /**
   * Sort tree nodes according to sort mode (recursive)
   *
   * @param node - Node whose children should be sorted
   * @param sortMode - Sort mode to apply
   */
  private sortTreeRecursive(node: TreeNode, sortMode: SortMode): void {
    if (node.children.length === 0) {
      return;
    }

    // Skip sorting if mode is "none"
    if (sortMode === "none") {
      // Still need to recursively process children
      for (const child of node.children) {
        this.sortTreeRecursive(child, sortMode);
      }
      return;
    }

    // Sort children according to mode
    node.children.sort((a, b) => {
      // Always keep tag/property nodes before file nodes
      if (a.type !== "file" && b.type === "file") {
        return -1;
      }
      if (a.type === "file" && b.type !== "file") {
        return 1;
      }

      // Apply sort mode
      switch (sortMode) {
        case "alpha-asc":
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });

        case "alpha-desc":
          return b.name.localeCompare(a.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });

        case "count-desc":
          // More files first
          if (a.fileCount !== b.fileCount) {
            return b.fileCount - a.fileCount;
          }
          // Tie-breaker: alphabetical
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });

        case "count-asc":
          // Fewer files first
          if (a.fileCount !== b.fileCount) {
            return a.fileCount - b.fileCount;
          }
          // Tie-breaker: alphabetical
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });

        default:
          // Default to alphabetical
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });
      }
    });

    // Recursively sort children
    for (const child of node.children) {
      this.sortTreeRecursive(child, sortMode);
    }
  }
}
