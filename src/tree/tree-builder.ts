import { TFile } from "obsidian";
import { VaultIndexer } from "../indexer/vault-indexer";
import { TreeNode, createTagNode, createFileNode } from "../types/tree-node";

/**
 * TreeBuilder - Transforms flat tag index into hierarchical tree structure
 *
 * Responsibilities:
 * - Transform flat tag index into hierarchical tree structure
 * - Support filtering by root tag
 * - Generate tree nodes with metadata (file count, children)
 * - Sort nodes alphabetically
 */
export class TreeBuilder {
  constructor(private indexer: VaultIndexer) {}

  /**
   * Build a tree from nested tags
   *
   * @param rootTag - Optional root tag to filter by (e.g., "project" will show only tags under #project)
   * @returns Root tree node with hierarchical structure
   */
  buildFromTags(rootTag?: string): TreeNode {
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

    // Sort all children alphabetically
    this.sortTreeRecursive(root);

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
   * Sort tree nodes alphabetically (recursive)
   *
   * @param node - Node whose children should be sorted
   */
  private sortTreeRecursive(node: TreeNode): void {
    if (node.children.length === 0) {
      return;
    }

    // Sort children alphabetically by name
    // Tag nodes first, then file nodes, each sorted alphabetically
    node.children.sort((a, b) => {
      // Tags before files
      if (a.type !== "file" && b.type === "file") {
        return -1;
      }
      if (a.type === "file" && b.type !== "file") {
        return 1;
      }

      // Alphabetical within same type
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    // Recursively sort children
    for (const child of node.children) {
      this.sortTreeRecursive(child);
    }
  }
}
