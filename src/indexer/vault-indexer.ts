import { App, Events, TFile, CachedMetadata } from "obsidian";

/**
 * VaultIndexer - Indexes all tags and frontmatter properties from vault files
 *
 * Responsibilities:
 * - Index all tags and frontmatter from vault files
 * - Maintain reverse mappings (tag → files, property → value → files)
 * - Subscribe to Obsidian's metadata cache events for incremental updates
 * - Provide query methods for tree builders
 */
export class VaultIndexer extends Events {
  private app: App;

  // Primary indices
  private tagToFiles: Map<string, Set<TFile>>;
  private propertyToValueToFiles: Map<string, Map<string, Set<TFile>>>;
  private fileToTags: Map<TFile, Set<string>>;
  private fileToProperties: Map<TFile, Record<string, any>>;

  // Cached hierarchical tag data
  private tagHierarchyCache: Map<string, string[]>;

  // Performance tracking
  private lastIndexTime: number;
  private fileCount: number;

  // Initialization state
  private initialized: boolean;

  // Debouncing for batch updates
  private updateQueue: Set<TFile>;
  private updateTimer: NodeJS.Timeout | null;
  private readonly DEBOUNCE_MS = 300;

  constructor(app: App) {
    super();
    this.app = app;
    this.tagToFiles = new Map();
    this.propertyToValueToFiles = new Map();
    this.fileToTags = new Map();
    this.fileToProperties = new Map();
    this.tagHierarchyCache = new Map();
    this.lastIndexTime = 0;
    this.fileCount = 0;
    this.initialized = false;
    this.updateQueue = new Set();
    this.updateTimer = null;
  }

  /**
   * Initialize the indexer by indexing all files in the vault
   * and setting up event listeners for incremental updates
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Wait for metadata cache to be ready
    await this.waitForMetadataCache();

    // Index all markdown files
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      await this.indexFile(file);
    }

    this.fileCount = files.length;
    this.lastIndexTime = Date.now();

    // Set up event listeners for incremental updates
    this.registerEventListeners();

    this.initialized = true;
  }

  /**
   * Wait for the metadata cache to be fully resolved
   */
  private async waitForMetadataCache(): Promise<void> {
    // Check if metadata cache is already resolved
    // Note: initialized property exists at runtime but not in type definitions
    if ((this.app.metadataCache as any).initialized) {
      return;
    }

    // Wait for 'resolved' event
    return new Promise((resolve) => {
      const handler = () => {
        this.app.metadataCache.off("resolved", handler);
        resolve();
      };
      this.app.metadataCache.on("resolved", handler);
    });
  }

  /**
   * Register event listeners for incremental index updates
   */
  private registerEventListeners(): void {
    // File modified
    this.app.metadataCache.on("changed", (file) => {
      this.updateFileIndex(file);
    });

    // File deleted
    this.app.vault.on("delete", (file) => {
      if (file instanceof TFile) {
        this.removeFileFromIndex(file);
      }
    });

    // File renamed
    this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile) {
        // Remove old entries and re-index
        this.removeFileFromIndex(file);
        this.updateFileIndex(file);
      }
    });
  }

  /**
   * Index a single file
   */
  private async indexFile(file: TFile): Promise<void> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);

      if (!cache) {
        console.warn(`[TagTree] No cache for file: ${file.path}`);
        return;
      }

      this.indexTags(file, cache);
      this.indexProperties(file, cache);
    } catch (error) {
      console.error(`[TagTree] Error indexing file ${file.path}:`, error);
    }
  }

  /**
   * Index tags from a file
   */
  private indexTags(file: TFile, cache: CachedMetadata): void {
    try {
      const tags = new Set<string>();

      // Index frontmatter tags
      if (cache.frontmatter?.tags) {
        const fmTags = Array.isArray(cache.frontmatter.tags)
          ? cache.frontmatter.tags
          : [cache.frontmatter.tags];

        fmTags.forEach((tag) => {
          if (typeof tag === "string") {
            tags.add(this.normalizeTag(tag));
          }
        });
      }

      // Index inline tags
      cache.tags?.forEach((tagCache) => {
        if (tagCache.tag) {
          tags.add(this.normalizeTag(tagCache.tag));
        }
      });

      // Build hierarchical cache and add to indices
      tags.forEach((tag) => {
        const hierarchy = this.parseTagHierarchy(tag);
        this.tagHierarchyCache.set(tag, hierarchy);

        // Add file to all parent tags in the hierarchy
        hierarchy.forEach((parentTag) => {
          if (!this.tagToFiles.has(parentTag)) {
            this.tagToFiles.set(parentTag, new Set());
          }
          this.tagToFiles.get(parentTag)!.add(file);
        });
      });

      this.fileToTags.set(file, tags);
    } catch (error) {
      console.error(`[TagTree] Error indexing tags for ${file.path}:`, error);
    }
  }

  /**
   * Index frontmatter properties from a file
   */
  private indexProperties(file: TFile, cache: CachedMetadata): void {
    try {
      if (!cache.frontmatter) {
        return;
      }

      const props: Record<string, any> = {};

      for (const [key, value] of Object.entries(cache.frontmatter)) {
        // Skip reserved Obsidian properties
        if (key === "tags" || key === "position") {
          continue;
        }

        props[key] = value;

        // Add to property index
        if (!this.propertyToValueToFiles.has(key)) {
          this.propertyToValueToFiles.set(key, new Map());
        }

        const valueMap = this.propertyToValueToFiles.get(key)!;
        const valueKey = String(value);

        if (!valueMap.has(valueKey)) {
          valueMap.set(valueKey, new Set());
        }
        valueMap.get(valueKey)!.add(file);
      }

      this.fileToProperties.set(file, props);
    } catch (error) {
      console.error(
        `[TagTree] Error indexing properties for ${file.path}:`,
        error
      );
    }
  }

  /**
   * Parse tag hierarchy
   * Example: "project/alpha/feature" → ["project", "project/alpha", "project/alpha/feature"]
   */
  private parseTagHierarchy(tag: string): string[] {
    const segments = tag.split("/");
    const hierarchy: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      hierarchy.push(segments.slice(0, i + 1).join("/"));
    }

    return hierarchy;
  }

  /**
   * Normalize tag (remove leading #, convert to lowercase)
   * Following Obsidian's convention of case-insensitive tags
   */
  private normalizeTag(tag: string): string {
    let normalized = tag.startsWith("#") ? tag.slice(1) : tag;
    // Obsidian normalizes tags to lowercase
    normalized = normalized.toLowerCase();
    return normalized;
  }

  /**
   * Schedule an update for a file (debounced)
   */
  private updateFileIndex(file: TFile): void {
    // Add file to update queue
    this.updateQueue.add(file);

    // Clear existing timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    // Schedule batch update
    this.updateTimer = setTimeout(() => {
      this.processBatchUpdate();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Process batch update of all queued files
   */
  private async processBatchUpdate(): Promise<void> {
    const filesToUpdate = Array.from(this.updateQueue);
    this.updateQueue.clear();
    this.updateTimer = null;

    // Update all queued files
    for (const file of filesToUpdate) {
      // Remove old entries
      this.removeFileFromIndex(file);

      // Re-index the file
      await this.indexFile(file);
    }

    // Update timestamp
    this.lastIndexTime = Date.now();

    // Notify listeners once for the batch
    this.trigger("index-updated");
  }

  /**
   * Remove a file from all indices
   */
  private removeFileFromIndex(file: TFile): void {
    // Remove from tag indices
    const tags = this.fileToTags.get(file);
    if (tags) {
      tags.forEach((tag) => {
        const hierarchy = this.tagHierarchyCache.get(tag);
        if (hierarchy) {
          hierarchy.forEach((parentTag) => {
            const files = this.tagToFiles.get(parentTag);
            if (files) {
              files.delete(file);
              if (files.size === 0) {
                this.tagToFiles.delete(parentTag);
              }
            }
          });
        }
        this.tagHierarchyCache.delete(tag);
      });
      this.fileToTags.delete(file);
    }

    // Remove from property indices
    const props = this.fileToProperties.get(file);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        const valueMap = this.propertyToValueToFiles.get(key);
        if (valueMap) {
          const valueKey = String(value);
          const files = valueMap.get(valueKey);
          if (files) {
            files.delete(file);
            if (files.size === 0) {
              valueMap.delete(valueKey);
            }
          }
          if (valueMap.size === 0) {
            this.propertyToValueToFiles.delete(key);
          }
        }
      }
      this.fileToProperties.delete(file);
    }
  }

  /**
   * Get all files with a specific tag (including nested tags)
   */
  getFilesWithTag(tag: string): Set<TFile> {
    const normalizedTag = this.normalizeTag(tag);
    return this.tagToFiles.get(normalizedTag) || new Set();
  }

  /**
   * Get all files with a specific property value
   */
  getFilesWithProperty(property: string, value?: string): Set<TFile> {
    const valueMap = this.propertyToValueToFiles.get(property);
    if (!valueMap) {
      return new Set();
    }

    if (value !== undefined) {
      return valueMap.get(value) || new Set();
    }

    // Return all files with this property (any value)
    const allFiles = new Set<TFile>();
    valueMap.forEach((files) => {
      files.forEach((file) => allFiles.add(file));
    });
    return allFiles;
  }

  /**
   * Get all nested tags under a root tag
   */
  getNestedTagsUnder(rootTag: string): string[] {
    const normalizedRoot = this.normalizeTag(rootTag);
    const nestedTags: string[] = [];

    this.tagToFiles.forEach((_, tag) => {
      if (tag === normalizedRoot || tag.startsWith(normalizedRoot + "/")) {
        nestedTags.push(tag);
      }
    });

    return nestedTags;
  }

  /**
   * Get all tags in the vault
   */
  getAllTags(): string[] {
    return Array.from(this.tagToFiles.keys());
  }

  /**
   * Get all tags for a specific file
   */
  getFileTags(file: TFile): Set<string> {
    return this.fileToTags.get(file) || new Set();
  }

  /**
   * Get all properties for a specific file
   */
  getFileProperties(file: TFile): Record<string, any> {
    return this.fileToProperties.get(file) || {};
  }

  /**
   * Get the timestamp of the last index operation
   */
  getLastIndexTime(): number {
    return this.lastIndexTime;
  }

  /**
   * Get the total number of indexed files
   */
  getFileCount(): number {
    return this.fileCount;
  }

  /**
   * Get all indexed files
   */
  getAllFiles(): TFile[] {
    return Array.from(this.fileToTags.keys());
  }

  /**
   * Refresh the entire index (full re-index)
   */
  async refresh(): Promise<void> {
    // Clear all indices
    this.tagToFiles.clear();
    this.propertyToValueToFiles.clear();
    this.fileToTags.clear();
    this.fileToProperties.clear();
    this.tagHierarchyCache.clear();

    // Re-index all files
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      await this.indexFile(file);
    }

    this.fileCount = files.length;
    this.lastIndexTime = Date.now();

    // Notify listeners
    this.trigger("index-updated");
  }
}
