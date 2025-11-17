import { TreeNode } from "../types/tree-node";
import { HierarchyConfig, HierarchyLevel, PropertyHierarchyLevel } from "../types/hierarchy-config";

/**
 * Builds an Obsidian search query from a tree node
 *
 * The query includes:
 * - All ancestor property filters (combined with AND)
 * - All ancestor tag filters (combined with AND)
 * - The node's own filter
 *
 * Examples:
 * - Tag node: "tag:#project/backend/api"
 * - Property node: "[status:active]"
 * - Combined: "tag:#project/backend [status:active] [priority:high]"
 */
export class SearchQueryBuilder {
  private hierarchyConfig: HierarchyConfig;

  constructor(hierarchyConfig: HierarchyConfig) {
    this.hierarchyConfig = hierarchyConfig;
  }

  /**
   * Build a search query for a given node
   * Traverses from the node up to the root, collecting all filters
   */
  buildQuery(node: TreeNode): string {
    const filters: string[] = [];

    // Traverse from node to root, collecting filters
    let currentNode: TreeNode | undefined = node;
    while (currentNode) {
      const filter = this.buildNodeFilter(currentNode);
      if (filter) {
        // Add to the beginning to maintain hierarchy order (root -> leaf)
        filters.unshift(filter);
      }
      currentNode = currentNode.parent;
    }

    // Combine filters with space (Obsidian's implicit AND)
    return filters.join(" ");
  }

  /**
   * Build a filter for a single node
   */
  private buildNodeFilter(node: TreeNode): string | null {
    if (node.type === "tag") {
      return this.buildTagFilter(node);
    } else if (node.type === "property-group") {
      return this.buildPropertyFilter(node);
    }
    // File nodes don't contribute to search query
    return null;
  }

  /**
   * Build a tag filter
   * Format: tag:#path/to/tag
   */
  private buildTagFilter(node: TreeNode): string | null {
    const tagPath = node.metadata?.tagPath;
    if (!tagPath) {
      return null;
    }

    // Use Obsidian's tag search syntax
    return `tag:#${tagPath}`;
  }

  /**
   * Build a property filter
   * Format: [propertyKey:propertyValue]
   *
   * Handles list properties based on the separateListValues setting:
   * - If separateListValues is true: each value is treated separately
   * - If separateListValues is false: the entire list is treated as one value
   */
  private buildPropertyFilter(node: TreeNode): string | null {
    const propertyKey = node.metadata?.propertyKey;
    const propertyValue = node.metadata?.propertyValue;

    if (!propertyKey || propertyValue === undefined || propertyValue === null) {
      return null;
    }

    // Find the corresponding hierarchy level to check separateListValues setting
    const hierarchyLevel = this.findPropertyLevel(node);
    const separateListValues = hierarchyLevel?.separateListValues ?? true;

    // Convert value to string
    const valueStr = String(propertyValue);

    // Use Obsidian's property search syntax
    // For both separateListValues cases, the syntax is the same: [property:value]
    // Obsidian will automatically handle list containment checking
    return `[${propertyKey}:${valueStr}]`;
  }

  /**
   * Find the hierarchy level configuration for a property node
   * This is needed to determine the separateListValues setting
   */
  private findPropertyLevel(node: TreeNode): PropertyHierarchyLevel | null {
    const propertyKey = node.metadata?.propertyKey;
    if (!propertyKey) {
      return null;
    }

    // Find the matching level in the hierarchy config
    // We look for the level at the node's depth in the hierarchy
    for (const level of this.hierarchyConfig.levels) {
      if (level.type === "property" && level.key === propertyKey) {
        return level;
      }
    }

    return null;
  }

  /**
   * Escape special characters in search values if needed
   * Obsidian search syntax may require escaping certain characters
   */
  private escapeSearchValue(value: string): string {
    // For now, we don't escape anything
    // If we find issues with special characters, we can add escaping here
    return value;
  }
}
