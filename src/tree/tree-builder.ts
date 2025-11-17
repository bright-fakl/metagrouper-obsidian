import { TFile } from "obsidian";
import { VaultIndexer } from "../indexer/vault-indexer";
import {
  TreeNode,
  createTagNode,
  createFileNode,
  createPropertyGroupNode,
} from "../types/tree-node";
import { SortMode } from "../types/view-state";
import {
  HierarchyConfig,
  HierarchyLevel,
  TagHierarchyLevel,
  PropertyHierarchyLevel,
} from "../types/hierarchy-config";

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

      // Find parent node to get parent ID
      const parentTag = segments.slice(0, -1).join("/");
      const parent = parentTag ? nodeMap.get(parentTag) : root;

      // Create the tag node (without files yet)
      const node = createTagNode(tag, [], depth, {
        parentId: parent?.id,
      });
      nodeMap.set(tag, node);

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
        const fileNode = createFileNode(file, node.depth + 1, node.id);
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
      // Always keep file nodes before tag/property nodes at the same level
      if (a.type === "file" && b.type !== "file") {
        return -1;
      }
      if (a.type !== "file" && b.type === "file") {
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

  /**
   * Build a tree from a hierarchy configuration
   * Supports multi-level grouping by tags and properties
   *
   * @param config - Hierarchy configuration defining the tree structure
   * @returns Root tree node with hierarchical structure
   */
  buildFromHierarchy(config: HierarchyConfig): TreeNode {
    // Optimization: For simple single-level tag hierarchies with unlimited depth,
    // use buildFromTags which is more efficient for full nested hierarchies
    if (this.shouldUseBuildFromTags(config)) {
      const tagLevel = config.levels[0] as TagHierarchyLevel;
      return this.buildFromTags(
        config.rootTag?.replace(/^#/, ""),
        config.sortMode || "alpha-asc"
      );
    }

    // Get initial file set (optionally filtered by root tag)
    const allFiles = this.indexer.getAllFiles();
    let files: TFile[];

    if (config.rootTag) {
      // Filter files that have the root tag
      const normalizedRootTag = config.rootTag.toLowerCase().replace(/^#/, "");
      files = allFiles.filter((file) => {
        const tags = this.indexer.getFileTags(file);
        return Array.from(tags).some(
          (tag) =>
            tag === normalizedRootTag || tag.startsWith(normalizedRootTag + "/")
        );
      });
    } else {
      files = allFiles;
    }

    // Build tree recursively through hierarchy levels
    const root = this.buildLevelRecursive(
      files,
      config.levels,
      0,
      undefined,
      config.showPartialMatches
    );

    // Apply sorting according to config
    const sortMode = config.sortMode || "alpha-asc";
    this.sortTreeRecursive(root, sortMode);

    // Calculate aggregate file counts
    this.calculateFileCounts(root);

    return root;
  }

  /**
   * Check if we should use buildFromTags for optimization
   *
   * @param config - Hierarchy configuration
   * @returns True if should delegate to buildFromTags
   */
  private shouldUseBuildFromTags(config: HierarchyConfig): boolean {
    // Must be a single-level hierarchy
    if (config.levels.length !== 1) {
      return false;
    }

    const level = config.levels[0];

    // Must be a tag level
    if (level.type !== "tag") {
      return false;
    }

    const tagLevel = level as TagHierarchyLevel;

    // Must have unlimited depth (-1)
    // If depth is 1 or greater, we need to use buildFromHierarchy to honor that limit
    if (tagLevel.depth !== -1) {
      return false;
    }

    // Must not use advanced features
    if (tagLevel.virtual) {
      return false;
    }

    // Simple unlimited-depth tag hierarchy - use buildFromTags for optimization
    return true;
  }

  /**
   * Recursively build tree levels according to hierarchy configuration
   *
   * @param files - Files to process at this level
   * @param levels - Remaining hierarchy levels to process
   * @param depth - Current depth in the tree
   * @param parentTagPath - Tag path from parent tag level (for nested tag grouping)
   * @param showPartialMatches - Whether to show files at intermediate levels
   * @param parentId - Parent node ID for creating unique hierarchical IDs
   * @returns Tree node representing this level
   */
  private buildLevelRecursive(
    files: TFile[],
    levels: HierarchyLevel[],
    depth: number,
    parentTagPath?: string,
    showPartialMatches: boolean = false,
    parentId?: string
  ): TreeNode {
    // Base case: no more levels or no files
    if (depth >= levels.length || files.length === 0) {
      const fileNodes = files.map((f) => createFileNode(f, depth, parentId));
      return {
        id: parentId || "root",
        name: "Root",
        type: "tag",
        children: fileNodes,
        depth,
        files: [],
        fileCount: files.length,
      };
    }

    const level = levels[depth];

    // Handle tag levels with depth > 1 or depth = -1 (unlimited) specially
    if (level.type === "tag") {
      const tagLevel = level as TagHierarchyLevel;
      const tagDepth = tagLevel.depth || 1;

      if (tagDepth > 1 || tagDepth === -1) {
        // Multi-depth tag level - build intermediate tag levels
        // For depth=-1, this will recurse until no more nested tags exist
        return this.buildMultiDepthTagLevel(
          files,
          levels,
          depth,
          tagLevel,
          parentTagPath,
          0, // Start at sub-depth 0
          showPartialMatches,
          parentId
        );
      }
    }

    // Single-depth grouping (original logic)
    const groups = this.groupFilesByLevel(files, level, parentTagPath);

    // Create nodes for each group
    const children: TreeNode[] = [];

    for (const [groupKey, groupFiles] of groups.entries()) {
      // Create the group node
      let node: TreeNode;
      if (level.type === "tag") {
        const tagLevel = level as TagHierarchyLevel;
        node = createTagNode(groupKey, [], depth, {
          label: tagLevel.label,
          showFullPath: tagLevel.showFullPath,
          parentId,
        });
      } else {
        const propLevel = level as PropertyHierarchyLevel;
        node = createPropertyGroupNode(level.key, groupKey, [], depth, {
          label: propLevel.label,
          showPropertyName: propLevel.showPropertyName,
          parentId,
        });
      }

      // Separate files: those that match next level vs those that end here
      const filesForNextLevel: TFile[] = [];
      const filesForThisLevel: TFile[] = [];

      if (depth + 1 < levels.length) {
        const nextLevel = levels[depth + 1];
        // Determine parent tag path for checking next level
        const nextParentTagPath =
          level.type === "tag" ? groupKey : parentTagPath;

        for (const file of groupFiles) {
          if (this.fileMatchesLevel(file, nextLevel, nextParentTagPath)) {
            filesForNextLevel.push(file);
          } else {
            filesForThisLevel.push(file);
          }
        }
      } else {
        // No more levels, all files end here
        filesForThisLevel.push(...groupFiles);
      }

      // Add file nodes for files that end at this level
      // Only add if showPartialMatches=true OR this is the last hierarchy level
      if (showPartialMatches || depth + 1 >= levels.length) {
        for (const file of filesForThisLevel) {
          node.children.push(createFileNode(file, depth + 1, node.id));
        }
      }

      // Recursively build next level for files that continue
      if (filesForNextLevel.length > 0) {
        // Determine parent tag path for next level
        const newParentTagPath =
          level.type === "tag" ? groupKey : parentTagPath;

        const childTreeNode = this.buildLevelRecursive(
          filesForNextLevel,
          levels,
          depth + 1,
          newParentTagPath,
          showPartialMatches,
          node.id
        );

        // Add children from recursive call
        node.children.push(...childTreeNode.children);
      }

      children.push(node);
    }

    return {
      id: "root",
      name: "Root",
      type: "tag",
      children,
      depth,
      files: [],
      fileCount: 0,
    };
  }

  /**
   * Build multiple tree levels for a single tag hierarchy level with depth > 1
   *
   * @param files - Files to process
   * @param levels - All hierarchy levels
   * @param hierarchyDepth - Current hierarchy level index
   * @param tagLevel - The tag level being processed
   * @param parentTagPath - Parent tag path for nested grouping
   * @param subDepth - Current sub-depth within this tag level (0 to tagDepth-1)
   * @param showPartialMatches - Whether to show files at intermediate levels
   * @param parentId - Parent node ID for creating unique hierarchical IDs
   * @returns Tree node with multi-level tag structure
   */
  private buildMultiDepthTagLevel(
    files: TFile[],
    levels: HierarchyLevel[],
    hierarchyDepth: number,
    tagLevel: TagHierarchyLevel,
    parentTagPath: string | undefined,
    subDepth: number,
    showPartialMatches: boolean = false,
    parentId?: string
  ): TreeNode {
    const tagDepth = tagLevel.depth || 1;
    const treeDepth = hierarchyDepth;

    // Group files by tags at current sub-depth (1 level at a time)
    const groups = new Map<string, TFile[]>();

    for (const file of files) {
      // Always look for immediate children (depth 1) relative to parent
      // The subDepth counter is only for tracking when to stop recursion
      const targetDepth = parentTagPath ? 1 : (subDepth + 1);

      const matchingTags = this.findMatchingTagsAtDepth(
        file,
        tagLevel.key,
        parentTagPath,
        targetDepth
      );

      for (const tag of matchingTags) {
        if (!groups.has(tag)) {
          groups.set(tag, []);
        }
        groups.get(tag)!.push(file);
      }
    }

    // If no tags found at this depth, we've reached the end of tag nesting
    // For depth=-1 (unlimited), this is when we stop recursing
    // For depth>1, we check if we've consumed all sub-depths
    if (groups.size === 0 || (tagDepth !== -1 && subDepth >= tagDepth)) {
      return this.buildLevelRecursive(
        files,
        levels,
        hierarchyDepth + 1,
        parentTagPath,
        showPartialMatches,
        parentId
      );
    }

    // Create nodes for each group
    const children: TreeNode[] = [];

    for (const [groupKey, groupFiles] of groups.entries()) {
      const node = createTagNode(groupKey, [], treeDepth + subDepth, {
        label: tagLevel.label,
        showFullPath: tagLevel.showFullPath,
        parentId,
      });

      // Check if there are more sub-depths to process
      // For depth=-1 (unlimited), always continue recursing (will stop when no more tags found)
      // For depth>1, check if we've reached the final tag depth
      const shouldContinueRecursing = (tagDepth === -1) || (subDepth + 1 < tagDepth);

      if (shouldContinueRecursing) {
        // Not at the final tag depth yet
        if (tagLevel.virtual && hierarchyDepth + 1 < levels.length) {
          // Virtual mode: insert next hierarchy level before continuing with tag sub-depths
          this.buildVirtualTagLevel(
            groupFiles,
            levels,
            hierarchyDepth,
            tagLevel,
            groupKey,
            subDepth,
            node,
            showPartialMatches,
            node.id
          );
        } else {
          // Non-virtual mode: continue directly to next tag sub-depth
          const childTreeNode = this.buildMultiDepthTagLevel(
            groupFiles,
            levels,
            hierarchyDepth,
            tagLevel,
            groupKey,
            subDepth + 1,
            showPartialMatches,
            node.id
          );

          node.children.push(...childTreeNode.children);
        }
      } else {
        // Last sub-depth of this tag level
        // Separate files: those that match next hierarchy level vs those that end here
        const filesForNextLevel: TFile[] = [];
        const filesForThisLevel: TFile[] = [];

        if (hierarchyDepth + 1 < levels.length) {
          const nextLevel = levels[hierarchyDepth + 1];

          for (const file of groupFiles) {
            if (this.fileMatchesLevel(file, nextLevel, groupKey)) {
              filesForNextLevel.push(file);
            } else {
              filesForThisLevel.push(file);
            }
          }
        } else {
          // No more hierarchy levels
          filesForThisLevel.push(...groupFiles);
        }

        // Add file nodes for files that end here
        // Only add if showPartialMatches=true OR this is the last hierarchy level
        if (showPartialMatches || hierarchyDepth + 1 >= levels.length) {
          for (const file of filesForThisLevel) {
            node.children.push(createFileNode(file, treeDepth + subDepth + 1, node.id));
          }
        }

        // Recursively build next hierarchy level for files that continue
        if (filesForNextLevel.length > 0) {
          const childTreeNode = this.buildLevelRecursive(
            filesForNextLevel,
            levels,
            hierarchyDepth + 1,
            groupKey,
            showPartialMatches,
            node.id
          );

          node.children.push(...childTreeNode.children);
        }
      }

      children.push(node);
    }

    return {
      id: parentId || "root",
      name: "Root",
      type: "tag",
      children,
      depth: treeDepth,
      files: [],
      fileCount: 0,
    };
  }

  /**
   * Build virtual tag level structure
   * Inserts next hierarchy level between intermediate tag levels
   *
   * @param files - Files to process
   * @param levels - All hierarchy levels
   * @param hierarchyDepth - Current hierarchy level index
   * @param tagLevel - The tag level being processed
   * @param currentTagPath - Current tag path
   * @param subDepth - Current sub-depth within tag level
   * @param parentNode - Parent node to add children to
   * @param showPartialMatches - Whether to show files at intermediate levels
   * @param parentId - Parent node ID for creating unique hierarchical IDs
   */
  private buildVirtualTagLevel(
    files: TFile[],
    levels: HierarchyLevel[],
    hierarchyDepth: number,
    tagLevel: TagHierarchyLevel,
    currentTagPath: string,
    subDepth: number,
    parentNode: TreeNode,
    showPartialMatches: boolean = false,
    parentId?: string
  ): void {
    const nextLevel = levels[hierarchyDepth + 1];
    const currentTreeDepth = hierarchyDepth + subDepth;

    // Separate files by whether they match the next hierarchy level
    const filesMatchingNext: TFile[] = [];
    const filesNotMatching: TFile[] = [];

    for (const file of files) {
      if (this.fileMatchesLevel(file, nextLevel, currentTagPath)) {
        filesMatchingNext.push(file);
      } else {
        filesNotMatching.push(file);
      }
    }

    // Files that don't match next level: continue directly with next tag sub-depth
    if (filesNotMatching.length > 0) {
      const childTreeNode = this.buildMultiDepthTagLevel(
        filesNotMatching,
        levels,
        hierarchyDepth,
        tagLevel,
        currentTagPath,
        subDepth + 1,
        showPartialMatches,
        parentId
      );

      parentNode.children.push(...childTreeNode.children);
    }

    // Files that match next level: insert next hierarchy level, then continue with tag sub-depths
    if (filesMatchingNext.length > 0) {
      // Group files by the next hierarchy level
      const groups = this.groupFilesByLevel(
        filesMatchingNext,
        nextLevel,
        currentTagPath
      );

      for (const [groupKey, groupFiles] of groups.entries()) {
        // Create node for next hierarchy level
        let nextLevelNode: TreeNode;
        if (nextLevel.type === "tag") {
          const tagLvl = nextLevel as TagHierarchyLevel;
          nextLevelNode = createTagNode(groupKey, [], currentTreeDepth + 1, {
            label: tagLvl.label,
            showFullPath: tagLvl.showFullPath,
            parentId,
          });
        } else {
          const propLvl = nextLevel as PropertyHierarchyLevel;
          nextLevelNode = createPropertyGroupNode(
            nextLevel.key,
            groupKey,
            [],
            currentTreeDepth + 1,
            {
              label: propLvl.label,
              showPropertyName: propLvl.showPropertyName,
              parentId,
            }
          );
        }

        // After inserting next level, continue with remaining tag sub-depths
        const childTreeNode = this.buildMultiDepthTagLevel(
          groupFiles,
          levels,
          hierarchyDepth,
          tagLevel,
          currentTagPath,
          subDepth + 1,
          showPartialMatches,
          nextLevelNode.id
        );

        nextLevelNode.children.push(...childTreeNode.children);
        parentNode.children.push(nextLevelNode);
      }
    }
  }

  /**
   * Find tags at a specific depth level (not cumulative)
   *
   * @param file - File to check
   * @param tagKey - Tag key/prefix to match
   * @param parentTagPath - Parent tag path
   * @param targetDepth - The specific depth to find tags at (1 = immediate children)
   * @returns Array of tags at exactly this depth
   */
  private findMatchingTagsAtDepth(
    file: TFile,
    tagKey: string,
    parentTagPath: string | undefined,
    targetDepth: number
  ): string[] {
    const fileTags = this.indexer.getFileTags(file);
    const matchingTags: string[] = [];

    // Determine the base path
    let basePath: string;
    if (parentTagPath && parentTagPath !== "") {
      // Within a tag group, look for children of parent
      basePath = parentTagPath;
    } else if (tagKey && tagKey !== "") {
      // Specific tag key provided
      basePath = tagKey;
    } else {
      // Empty key means all tags
      basePath = "";
    }

    for (const tag of fileTags) {
      let matchingTag: string | null = null;

      if (basePath === "") {
        // Match any tag at the target depth
        const segments = tag.split("/");
        if (segments.length >= targetDepth) {
          matchingTag = segments.slice(0, targetDepth).join("/");
        }
      } else if (tag === basePath && targetDepth === 0) {
        // Exact match (for depth 0)
        matchingTag = basePath;
      } else if (tag.startsWith(basePath + "/")) {
        // Tag is under basePath
        const remainder = tag.substring(basePath.length + 1);
        const segments = remainder.split("/");

        // Get tag at target depth
        if (segments.length >= targetDepth) {
          const truncated = segments.slice(0, targetDepth).join("/");
          matchingTag = basePath + "/" + truncated;
        }
      }

      if (matchingTag && !matchingTags.includes(matchingTag)) {
        matchingTags.push(matchingTag);
      }
    }

    return matchingTags;
  }

  /**
   * Group files according to a hierarchy level's criterion
   *
   * @param files - Files to group
   * @param level - Hierarchy level defining grouping criterion
   * @param parentTagPath - Parent tag path for nested tag grouping
   * @returns Map of group key to files in that group
   */
  private groupFilesByLevel(
    files: TFile[],
    level: HierarchyLevel,
    parentTagPath?: string
  ): Map<string, TFile[]> {
    const groups = new Map<string, TFile[]>();

    for (const file of files) {
      if (level.type === "property") {
        // Group by property value (with list handling)
        const propertyLevel = level as PropertyHierarchyLevel;
        const props = this.indexer.getFileProperties(file);
        const value = props[level.key];

        if (value !== undefined) {
          // Handle list properties
          if (Array.isArray(value)) {
            if (propertyLevel.separateListValues) {
              // Separate list values - create a group for each value
              for (const item of value) {
                const groupKey = String(item);
                if (!groups.has(groupKey)) {
                  groups.set(groupKey, []);
                }
                groups.get(groupKey)!.push(file);
              }
            } else {
              // Combined list values - treat as single value with bracket notation
              const groupKey = `[${value.map((v) => String(v)).join(", ")}]`;
              if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
              }
              groups.get(groupKey)!.push(file);
            }
          } else {
            // Non-list property - use as-is
            const groupKey = String(value);
            if (!groups.has(groupKey)) {
              groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(file);
          }
        }
        // Files without this property are not included (don't match this level)
      } else if (level.type === "tag") {
        // Group by matching tags (single depth only - multi-depth handled elsewhere)
        const matchingTags = this.findMatchingTags(
          file,
          level.key,
          parentTagPath,
          1 // Always use depth 1 here since multi-depth is handled separately
        );

        // File can appear in multiple groups if it has multiple matching tags
        for (const tag of matchingTags) {
          if (!groups.has(tag)) {
            groups.set(tag, []);
          }
          groups.get(tag)!.push(file);
        }
      }
    }

    return groups;
  }

  /**
   * Find tags that match the level's pattern for a given file
   * Handles nested tag hierarchies by finding tags at specified depth
   *
   * @param file - File to find matching tags for
   * @param tagKey - Tag key/prefix to match
   * @param parentTagPath - Parent tag path for nested matching
   * @param depth - Number of levels to traverse (default 1 for immediate children)
   * @param currentDepth - Current depth in the traversal (for internal recursion)
   * @returns Array of matching tag paths at the specified depth
   */
  private findMatchingTags(
    file: TFile,
    tagKey: string,
    parentTagPath?: string,
    depth: number = 1,
    currentDepth: number = 0
  ): string[] {
    const fileTags = this.indexer.getFileTags(file);
    const matchingTags: string[] = [];

    // Determine the base path to look under
    let basePath: string;
    if (tagKey && tagKey !== "") {
      // Specific tag key provided - look for tags starting with this key
      basePath = tagKey;
    } else if (parentTagPath && parentTagPath !== "") {
      // No specific key, but within a parent tag group - look for children of parent
      basePath = parentTagPath;
    } else {
      // Empty key means match all tags
      basePath = "";
    }

    for (const tag of fileTags) {
      let matchingTag: string | null = null;

      if (basePath === "") {
        // Match any tag (for empty key at top level)
        // Truncate to specified depth
        const segments = tag.split("/");
        if (segments.length >= depth) {
          matchingTag = segments.slice(0, depth).join("/");
        } else {
          matchingTag = tag;
        }
      } else if (tag === basePath) {
        // Exact match with base path
        matchingTag = basePath;
      } else if (tag.startsWith(basePath + "/")) {
        // Tag is under basePath, truncate to specified depth
        const remainder = tag.substring(basePath.length + 1);
        const segments = remainder.split("/");

        // Truncate to the specified depth after the base path
        const truncatedSegments = segments.slice(0, depth);
        matchingTag = basePath + "/" + truncatedSegments.join("/");
      }

      if (matchingTag && !matchingTags.includes(matchingTag)) {
        matchingTags.push(matchingTag);
      }
    }

    return matchingTags;
  }

  /**
   * Check if a file matches a hierarchy level's criterion
   *
   * @param file - File to check
   * @param level - Hierarchy level to check against
   * @param parentTagPath - Parent tag path for nested tag matching
   * @returns True if file matches the level's criterion
   */
  private fileMatchesLevel(
    file: TFile,
    level: HierarchyLevel,
    parentTagPath?: string
  ): boolean {
    if (level.type === "property") {
      const props = this.indexer.getFileProperties(file);
      const value = props[level.key];

      // Property must be defined and non-empty
      if (value === undefined) {
        return false;
      }

      // Empty arrays don't match
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }

      return true;
    } else if (level.type === "tag") {
      const matchingTags = this.findMatchingTags(
        file,
        level.key,
        parentTagPath
      );
      return matchingTags.length > 0;
    }
    return false;
  }
}
