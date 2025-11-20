import { App, TFile } from "obsidian";
import { VaultIndexer } from "../indexer/vault-indexer";
import {
  TreeNode,
  createTagNode,
  createFileNode,
  createPropertyGroupNode,
} from "../types/tree-node";
import { SortMode, FileSortMode, ViewState } from "../types/view-state";
import {
  HierarchyConfig,
  HierarchyLevel,
  TagHierarchyLevel,
  PropertyHierarchyLevel,
} from "../types/hierarchy-config";
import { FilterEvaluator } from "../filters/filter-evaluator";

/**
 * TreeBuilder - Transforms flat tag index into hierarchical tree structure
 *
 * Responsibilities:
 * - Transform flat tag index into hierarchical tree structure
 * - Support filtering via FilterEvaluator
 * - Generate tree nodes with metadata (file count, children)
 * - Sort nodes according to specified sort mode
 */
export class TreeBuilder {
  constructor(
    private app: App,
    private indexer: VaultIndexer
  ) {}

  /**
   * Build a tree from nested tags
   *
   * @param rootTag - Optional root tag to filter by (e.g., "project" will show only tags under #project)
   * @param sortMode - Sort mode to apply to tree nodes (default: "alpha-asc")
   * @param config - Optional hierarchy config for accessing default file sort mode
   * @param viewState - Optional view state for runtime file sort override
   * @returns Root tree node with hierarchical structure
   */
  buildFromTags(
    rootTag?: string,
    sortMode: SortMode = "alpha-asc",
    config?: HierarchyConfig,
    viewState?: ViewState,
    filteredFiles?: TFile[] // Optional: pre-filtered file set
  ): TreeNode {
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
        levelIndex: 0, // All tags in buildFromTags are at hierarchy level 0
      });
      nodeMap.set(tag, node);

      if (parent) {
        parent.children.push(node);
        node.parent = parent;
      }
    }

    // Add file nodes to leaf tag nodes
    this.addFileNodes(nodeMap, filteredFiles);

    // Calculate aggregate file counts BEFORE sorting
    // (needed for count-based sorting to work correctly)
    this.calculateFileCounts(root);

    // Sort all children - use new sorting if config provided, otherwise legacy
    if (config && viewState !== undefined) {
      // Use new sorting that separates file and node sorting
      this.sortTreeRecursiveNew(root, config, viewState, 0);
    } else {
      // Legacy path - use old sorting (for backward compatibility)
      this.sortTreeRecursive(root, sortMode);
    }

    return root;
  }

  /**
   * Add file nodes as children to tag nodes
   * Files are added to the deepest (most specific) tag they have
   *
   * @param nodeMap - Map of tag paths to tree nodes
   * @param filteredFiles - Optional pre-filtered file set. If provided, only files in this set will be added.
   */
  private addFileNodes(nodeMap: Map<string, TreeNode>, filteredFiles?: TFile[]): void {
    // Create a Set for fast lookup if filtered files provided
    const filteredFileSet = filteredFiles ? new Set(filteredFiles) : null;

    // For each tag node, get files that have exactly that tag
    for (const [tagPath, node] of nodeMap.entries()) {
      if (tagPath === "root") continue;

      // Get files with this specific tag
      const filesWithTag = this.indexer.getFilesWithTag(tagPath);

      // We need to find files that have this tag as their MOST SPECIFIC tag
      // (i.e., they don't have a more nested version of this tag)
      const filesToAdd: TFile[] = [];

      for (const file of filesWithTag) {
        // Skip files not in filtered set (if filtering is active)
        if (filteredFileSet && !filteredFileSet.has(file)) {
          continue;
        }

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
   * LEGACY METHOD - kept for buildFromTags compatibility
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
   * Sort tree with per-level and file-specific sorting (NEW)
   *
   * @param node - Node whose children should be sorted
   * @param config - Hierarchy configuration
   * @param viewState - Optional view state for runtime overrides
   * @param currentLevelIndex - Current hierarchy level index
   */
  private sortTreeRecursiveNew(
    node: TreeNode,
    config: HierarchyConfig,
    viewState?: ViewState,
    currentLevelIndex: number = 0
  ): void {
    if (node.children.length === 0) {
      return;
    }

    // Separate files from tag/property nodes
    const fileNodes: TreeNode[] = [];
    const tagPropertyNodes: TreeNode[] = [];

    for (const child of node.children) {
      if (child.type === "file") {
        fileNodes.push(child);
      } else {
        tagPropertyNodes.push(child);
        // Ensure levelIndex is set in metadata (should be set during tree building)
        // If not set, fall back to currentLevelIndex for backwards compatibility
        if (!child.metadata) {
          child.metadata = {};
        }
        if (child.metadata.levelIndex === undefined) {
          child.metadata.levelIndex = currentLevelIndex;
        }
      }
    }

    // Sort file nodes using file sort mode
    const fileSortMode = viewState?.fileSortMode ??
                         config.defaultFileSortMode ??
                         "alpha-asc";
    this.sortFiles(fileNodes, fileSortMode);

    // Sort tag/property nodes using level-specific or default sort mode
    // Use the CHILDREN's level index, not the parent's level index
    const childrenLevelIndex = tagPropertyNodes.length > 0
      ? (tagPropertyNodes[0].metadata?.levelIndex ?? currentLevelIndex)
      : currentLevelIndex;
    const nodeSortMode = this.getNodeSortMode(
      childrenLevelIndex,
      config,
      viewState
    );
    this.sortNodes(tagPropertyNodes, nodeSortMode);

    // Recombine: files first, then nodes (maintains current behavior)
    node.children = [...fileNodes, ...tagPropertyNodes];

    // Recursively sort children of tag/property nodes
    for (const child of tagPropertyNodes) {
      // Read the child's levelIndex from metadata (set during tree building)
      // This is more reliable than trying to compute it
      const childLevelIndex = child.metadata?.levelIndex ?? currentLevelIndex;
      this.sortTreeRecursiveNew(child, config, viewState, childLevelIndex);
    }
  }

  /**
   * Determine the hierarchy level index for a child node
   *
   * @param node - The node to check
   * @param currentLevelIndex - Current level index
   * @param config - Hierarchy configuration
   * @returns Next level index
   */
  private getNextLevelIndex(
    node: TreeNode,
    currentLevelIndex: number,
    config: HierarchyConfig
  ): number {
    // If we're beyond the hierarchy levels, stay at current
    if (currentLevelIndex >= config.levels.length) {
      return currentLevelIndex;
    }

    const currentLevel = config.levels[currentLevelIndex];

    // For tag levels with unlimited depth (-1) or depth > 1,
    // all nested tags are part of the same hierarchy level
    if (currentLevel.type === "tag") {
      const tagLevel = currentLevel as TagHierarchyLevel;
      const tagDepth = tagLevel.depth || 1;

      if (tagDepth === -1 || tagDepth > 1) {
        // Stay at the same hierarchy level index
        // All nested tags are part of this one configuration level
        return currentLevelIndex;
      }
    }

    // For single-depth levels, increment to next hierarchy level
    return currentLevelIndex + 1;
  }

  /**
   * Get the sort mode for a specific hierarchy level
   *
   * @param levelIndex - Index of the hierarchy level
   * @param config - Hierarchy configuration
   * @param viewState - Optional view state for runtime overrides
   * @returns Sort mode to use
   */
  private getNodeSortMode(
    levelIndex: number,
    config: HierarchyConfig,
    viewState?: ViewState
  ): SortMode {
    // 1. Check ViewState runtime override (NOT USED - per user's decision)
    // We decided level sorting changes via context menu go to config, not viewState

    // 2. Check hierarchy level config
    if (levelIndex < config.levels.length && config.levels[levelIndex]?.sortBy) {
      return config.levels[levelIndex].sortBy!;
    }

    // 3. Fall back to view default
    return config.defaultNodeSortMode ?? "alpha-asc";
  }

  /**
   * Sort file nodes according to file sort mode
   *
   * @param files - Array of file nodes to sort (modified in place)
   * @param mode - File sort mode
   */
  private sortFiles(files: TreeNode[], mode: FileSortMode): void {
    if (mode === "none" || files.length === 0) {
      return;
    }

    files.sort((a, b) => {
      const fileA = a.files[0]; // File nodes always have exactly 1 file
      const fileB = b.files[0];

      switch (mode) {
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

        case "created-asc":
          return fileA.stat.ctime - fileB.stat.ctime;

        case "created-desc":
          return fileB.stat.ctime - fileA.stat.ctime;

        case "modified-asc":
          return fileA.stat.mtime - fileB.stat.mtime;

        case "modified-desc":
          return fileB.stat.mtime - fileA.stat.mtime;

        case "size-asc":
          return fileA.stat.size - fileB.stat.size;

        case "size-desc":
          return fileB.stat.size - fileA.stat.size;

        default:
          return 0;
      }
    });
  }

  /**
   * Sort tag/property nodes according to sort mode
   *
   * @param nodes - Array of tag/property nodes to sort (modified in place)
   * @param mode - Sort mode
   */
  private sortNodes(nodes: TreeNode[], mode: SortMode): void {
    if (mode === "none" || nodes.length === 0) {
      return;
    }

    nodes.sort((a, b) => {
      switch (mode) {
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
  }

  /**
   * Build a tree from a hierarchy configuration
   * Supports multi-level grouping by tags and properties
   *
   * @param config - Hierarchy configuration defining the tree structure
   * @param viewState - Optional view state for runtime sort overrides
   * @returns Root tree node with hierarchical structure
   */
  buildFromHierarchy(config: HierarchyConfig, viewState?: ViewState): TreeNode {
    // Get initial file set (optionally filtered by filters)
    const allFiles = this.indexer.getAllFiles();
    let files: TFile[];

    if (config.filters && config.filters.filters && config.filters.filters.length > 0) {
      // Apply filters using FilterEvaluator
      const filterEvaluator = new FilterEvaluator(this.app, this.indexer);
      files = allFiles.filter((file) => filterEvaluator.evaluateFilters(file, config.filters));
    } else {
      files = allFiles;
    }

    // Optimization: For simple single-level tag hierarchies with unlimited depth,
    // use buildFromTags which is more efficient for full nested hierarchies
    if (this.shouldUseBuildFromTags(config)) {
      const tagLevel = config.levels[0] as TagHierarchyLevel;
      return this.buildFromTags(
        tagLevel.key || undefined,
        config.defaultNodeSortMode || "alpha-asc",
        config,
        viewState,
        files // Pass filtered files to buildFromTags
      );
    }

    // Build tree recursively through hierarchy levels
    const root = this.buildLevelRecursive(
      files,
      config.levels,
      0,
      undefined,
      config.showPartialMatches
    );

    // Calculate aggregate file counts BEFORE sorting
    // (needed for count-based sorting to work correctly)
    this.calculateFileCounts(root);

    // Apply sorting with per-level and file-specific logic
    this.sortTreeRecursiveNew(root, config, viewState, 0);

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
      // Tree depth is hierarchy level index + 1 (root is depth 0)
      // When we've exhausted all levels, depth is the next level index,
      // so file nodes should be at depth + 1
      const fileNodes = files.map((f) => createFileNode(f, depth + 1, parentId));
      return {
        id: parentId || "root",
        name: "Root",
        type: "tag",
        children: fileNodes,
        depth: 0, // This wrapper node is returned as the root
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

    // Track which files were successfully grouped
    const groupedFiles = new Set<TFile>();
    for (const groupFiles of groups.values()) {
      groupFiles.forEach(f => groupedFiles.add(f));
    }

    // Find files that didn't match this level (weren't grouped)
    const unmatchedFiles = files.filter(f => !groupedFiles.has(f));

    // Create nodes for each group
    const children: TreeNode[] = [];
    // Tree depth is hierarchy level index + 1 (root is depth 0)
    const treeDepth = depth + 1;

    for (const [groupKey, groupFiles] of groups.entries()) {
      // Create the group node
      let node: TreeNode;
      if (level.type === "tag") {
        const tagLevel = level as TagHierarchyLevel;
        node = createTagNode(groupKey, [], treeDepth, {
          label: tagLevel.label,
          showFullPath: tagLevel.showFullPath,
          parentId,
          levelIndex: depth, // Set hierarchy level index
        });
      } else {
        const propLevel = level as PropertyHierarchyLevel;
        node = createPropertyGroupNode(level.key, groupKey, [], treeDepth, {
          label: propLevel.label,
          showPropertyName: propLevel.showPropertyName,
          parentId,
          levelIndex: depth, // Set hierarchy level index
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
          const fileNode = createFileNode(file, treeDepth + 1, node.id);
          fileNode.parent = node;
          node.children.push(fileNode);
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

        // Add children from recursive call and set parent references
        for (const child of childTreeNode.children) {
          child.parent = node;
          node.children.push(child);
        }
      }

      children.push(node);
    }

    // Add unmatched files as partial matches if enabled
    // These are files that matched previous levels but don't match this level
    // Only show if depth > 0 (they've matched at least one previous level)
    if (showPartialMatches && unmatchedFiles.length > 0 && depth > 0) {
      // Add them as file nodes directly to the children
      for (const file of unmatchedFiles) {
        const fileNode = createFileNode(file, treeDepth, parentId);
        children.push(fileNode);
      }
    }

    return {
      id: "root",
      name: "Root",
      type: "tag",
      children,
      depth: 0, // Root wrapper is always depth 0
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
    // Tree depth is hierarchy level index + 1 (root is depth 0)
    const treeDepth = hierarchyDepth + 1;

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
        levelIndex: hierarchyDepth, // Set hierarchy level index (not treeDepth!)
      });

      // Check if there are more sub-depths to process
      // For depth=-1 (unlimited), always continue recursing (will stop when no more tags found)
      // For depth>1, check if we've reached the final tag depth
      const shouldContinueRecursing = (tagDepth === -1) || (subDepth + 1 < tagDepth);

      if (shouldContinueRecursing) {
        // Not at the final tag depth yet
        // For single-level tag hierarchies, we need to handle files whose most specific
        // tag is at THIS level (they don't have deeper nested tags)
        const filesEndingHere: TFile[] = [];
        const filesWithDeeperTags: TFile[] = [];

        if (hierarchyDepth + 1 >= levels.length) {
          // This is a single-level tag hierarchy, check for files ending at this tag
          for (const file of groupFiles) {
            const fileTags = Array.from(this.indexer.getFileTags(file));
            // Check if this file has any tags deeper than groupKey
            const hasDeeper = fileTags.some(tag =>
              tag.startsWith(groupKey + "/") && tag.length > groupKey.length + 1
            );

            if (hasDeeper) {
              filesWithDeeperTags.push(file);
            } else {
              filesEndingHere.push(file);
            }
          }

          // For single-level tag hierarchies, always show files at their natural tag level
          // They are not "partial matches" - they fully match the tag they have
          // The showPartialMatches setting only applies to multi-level hierarchies
          for (const file of filesEndingHere) {
            const fileNode = createFileNode(file, treeDepth + subDepth + 1, node.id);
            fileNode.parent = node;
            node.children.push(fileNode);
          }
        } else {
          // Multi-level hierarchy, use all files for recursion
          filesWithDeeperTags.push(...groupFiles);
        }

        if (tagLevel.virtual && hierarchyDepth + 1 < levels.length) {
          // Virtual mode: insert next hierarchy level before continuing with tag sub-depths
          this.buildVirtualTagLevel(
            filesWithDeeperTags,
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
            filesWithDeeperTags,
            levels,
            hierarchyDepth,
            tagLevel,
            groupKey,
            subDepth + 1,
            showPartialMatches,
            node.id
          );

          // Add children and set parent references
          for (const child of childTreeNode.children) {
            child.parent = node;
            node.children.push(child);
          }
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
            const fileNode = createFileNode(file, treeDepth + subDepth + 1, node.id);
            fileNode.parent = node;
            node.children.push(fileNode);
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

          // Add children and set parent references
          for (const child of childTreeNode.children) {
            child.parent = node;
            node.children.push(child);
          }
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

      // Add children and set parent references
      for (const child of childTreeNode.children) {
        child.parent = parentNode;
        parentNode.children.push(child);
      }
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
            levelIndex: hierarchyDepth + 1, // Set hierarchy level index
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
              levelIndex: hierarchyDepth + 1, // Set hierarchy level index
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

        // Add children and set parent references
        for (const child of childTreeNode.children) {
          child.parent = nextLevelNode;
          nextLevelNode.children.push(child);
        }
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
