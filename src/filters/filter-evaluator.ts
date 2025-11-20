import { App, TFile } from "obsidian";
import { VaultIndexer } from "../indexer/vault-indexer";
import {
  FilterConfig,
  LabeledFilter,
  Filter,
  TagFilter,
  PropertyExistsFilter,
  PropertyValueFilter,
  FilePathFilter,
  FileSizeFilter,
  FileDateFilter,
  LinkCountFilter,
  BookmarkFilter,
  PropertyOperator,
  PropertyValueType,
} from "../types/filters";
import {
  parseSmartDate,
  matchWildcard,
  isValidNumber,
  normalizeTag,
  isSameDay,
  getAgeInDays,
} from "./filter-utils";
import { ExpressionParser } from "./expression-parser";
import { ExpressionEvaluator } from "./expression-evaluator";

/**
 * FilterEvaluator - Evaluates filter configurations against files
 *
 * Responsibilities:
 * - Parse and evaluate boolean expressions
 * - Evaluate individual filters with NOT support
 * - Handle all filter types (tag, property, file metadata, links, bookmarks)
 * - Gracefully handle missing data and invalid filters
 */
export class FilterEvaluator {
  private expressionParser = new ExpressionParser();
  private expressionEvaluator = new ExpressionEvaluator();

  constructor(
    private app: App,
    private indexer: VaultIndexer
  ) {}

  /**
   * Evaluate filters against a file
   * Returns true if file matches the filter configuration
   */
  evaluateFilters(file: TFile, filterConfig?: FilterConfig): boolean {
    if (!filterConfig || !filterConfig.filters || filterConfig.filters.length === 0) {
      return true; // No filters = show all files
    }

    const enabledFilters = filterConfig.filters.filter((lf) => lf.enabled !== false);

    if (enabledFilters.length === 0) {
      return true; // All filters disabled = show all files
    }

    // Parse expression
    let expression = filterConfig.expression?.trim() || '';
    if (!expression) {
      // No expression provided - default to AND all filters
      const labels = enabledFilters.map((lf) => lf.label);
      expression = ExpressionEvaluator.generateDefaultExpression(labels);
    }

    const parseResult = this.expressionParser.parse(expression);
    if (parseResult.errors.length > 0 || !parseResult.ast) {
      console.warn('FilterEvaluator: Invalid expression, showing all files:', parseResult.errors);
      return true; // Invalid expression = show all files (fail-safe)
    }

    // Evaluate each filter
    const filterResults = new Map<string, boolean>();
    for (const labeledFilter of enabledFilters) {
      const result = this.evaluateFilter(file, labeledFilter.filter);
      console.log(`[TagTree] Filter ${labeledFilter.label} (${labeledFilter.filter.type}): ${result}, negate: ${labeledFilter.filter.negate}, file: ${file.basename}`);
      filterResults.set(labeledFilter.label, result);
    }

    // Evaluate expression with filter results
    const finalResult = this.expressionEvaluator.evaluate(parseResult.ast, filterResults);
    console.log(`[TagTree] Expression "${expression}" result: ${finalResult}, file: ${file.basename}`);
    return finalResult;
  }

  /**
   * Evaluate a single filter against a file
   */
  private evaluateFilter(file: TFile, filter: Filter): boolean {
    // Clean up legacy negate field from filters that don't use it
    // Only PropertyExistsFilter should have negate field
    if (filter.type !== "property-exists" && filter.negate !== undefined) {
      console.log(`[TagTree] Cleaning up legacy negate field from ${filter.type} filter`);
      delete filter.negate;
    }

    let result: boolean;

    try {
      switch (filter.type) {
        case "tag":
          result = this.evaluateTagFilter(file, filter);
          break;
        case "property-exists":
          result = this.evaluatePropertyExistsFilter(file, filter);
          break;
        case "property-value":
          result = this.evaluatePropertyValueFilter(file, filter);
          break;
        case "file-path":
          result = this.evaluateFilePathFilter(file, filter);
          break;
        case "file-size":
          result = this.evaluateFileSizeFilter(file, filter);
          break;
        case "file-ctime":
        case "file-mtime":
          result = this.evaluateFileDateFilter(file, filter);
          break;
        case "link-count":
          result = this.evaluateLinkCountFilter(file, filter);
          break;
        case "bookmark":
          result = this.evaluateBookmarkFilter(file, filter);
          break;
        default:
          // Unknown filter type = pass through (graceful degradation)
          result = true;
      }
    } catch (error) {
      console.error(`[TagTree] Error evaluating filter ${filter.id}:`, error);
      result = false; // Errors = no match
    }

    // Apply negation if specified
    return filter.negate ? !result : result;
  }

  // ============================================================================
  // Tag Filter
  // ============================================================================

  private evaluateTagFilter(file: TFile, filter: TagFilter): boolean {
    if (!filter.tag || filter.tag.trim() === "") {
      return false; // Invalid filter
    }

    const tags = this.indexer.getFileTags(file);
    const normalizedFilterTag = normalizeTag(filter.tag);

    switch (filter.matchMode) {
      case "exact":
        return tags.has(normalizedFilterTag);

      case "prefix":
        return Array.from(tags).some(
          (tag) => tag === normalizedFilterTag || tag.startsWith(normalizedFilterTag + "/")
        );

      case "contains":
        return Array.from(tags).some((tag) => tag.includes(normalizedFilterTag));

      default:
        return false;
    }
  }

  // ============================================================================
  // Property Filters
  // ============================================================================

  private evaluatePropertyExistsFilter(file: TFile, filter: PropertyExistsFilter): boolean {
    if (!filter.property || filter.property.trim() === "") {
      return false; // Invalid filter
    }

    const properties = this.indexer.getFileProperties(file);
    return filter.property in properties;
  }

  private evaluatePropertyValueFilter(file: TFile, filter: PropertyValueFilter): boolean {
    if (!filter.property || filter.property.trim() === "") {
      return false; // Invalid filter
    }

    const properties = this.indexer.getFileProperties(file);
    const actualValue = properties[filter.property];

    if (actualValue === undefined || actualValue === null) {
      return false; // Property doesn't exist
    }

    // Determine property type
    const valueType = this.getPropertyValueType(filter.property, filter.valueType);

    if (!valueType) {
      return false; // Unknown type
    }

    return this.comparePropertyValue(actualValue, filter.operator, filter.value, filter.valueMax, valueType);
  }

  /**
   * Get the type of a property value
   * First check Obsidian's property registry, fallback to user-specified type
   */
  private getPropertyValueType(property: string, userSpecifiedType?: PropertyValueType): PropertyValueType | null {
    // Try to get type from Obsidian's property registry
    const metadataTypeManager = (this.app as any).metadataTypeManager;
    if (metadataTypeManager) {
      const registeredType = metadataTypeManager.getPropertyInfo(property)?.type;
      if (registeredType) {
        // Map Obsidian types to our types
        switch (registeredType) {
          case "text":
          case "multitext":
            return "string";
          case "number":
            return "number";
          case "date":
          case "datetime":
            return "date";
          case "checkbox":
            return "boolean";
          case "tags":
          case "aliases":
            return "array";
          default:
            return "string";
        }
      }
    }

    // Fallback to user-specified type
    return userSpecifiedType || null;
  }

  /**
   * Compare a property value against an operator and expected value
   */
  private comparePropertyValue(
    actual: any,
    operator: PropertyOperator,
    expected: any,
    expectedMax: any,
    valueType: PropertyValueType
  ): boolean {
    switch (valueType) {
      case "string":
        return this.compareStringValue(actual, operator, expected);
      case "number":
        return this.compareNumberValue(actual, operator, expected, expectedMax);
      case "date":
        return this.compareDateValue(actual, operator, expected, expectedMax);
      case "boolean":
        return this.compareBooleanValue(actual, operator);
      case "array":
        return this.compareArrayValue(actual, operator, expected);
      default:
        return false;
    }
  }

  private compareStringValue(actual: any, operator: PropertyOperator, expected: any): boolean {
    const actualStr = String(actual).toLowerCase();
    const expectedStr = String(expected).toLowerCase();

    switch (operator) {
      case "equals":
        return actualStr === expectedStr;
      case "not-equals":
        return actualStr !== expectedStr;
      case "contains":
        return actualStr.includes(expectedStr);
      case "not-contains":
        return !actualStr.includes(expectedStr);
      case "starts-with":
        return actualStr.startsWith(expectedStr);
      case "ends-with":
        return actualStr.endsWith(expectedStr);
      case "matches-regex":
        try {
          const regex = new RegExp(String(expected));
          return regex.test(String(actual));
        } catch {
          return false; // Invalid regex
        }
      default:
        return false;
    }
  }

  private compareNumberValue(
    actual: any,
    operator: PropertyOperator,
    expected: any,
    expectedMax?: any
  ): boolean {
    const actualNum = Number(actual);
    const expectedNum = Number(expected);

    if (!isValidNumber(actualNum) || !isValidNumber(expectedNum)) {
      return false; // Non-numeric values don't match
    }

    switch (operator) {
      case "number-eq":
        return actualNum === expectedNum;
      case "number-lt":
        return actualNum < expectedNum;
      case "number-lte":
        return actualNum <= expectedNum;
      case "number-gt":
        return actualNum > expectedNum;
      case "number-gte":
        return actualNum >= expectedNum;
      case "number-in-range": {
        const maxNum = Number(expectedMax);
        if (!isValidNumber(maxNum)) return false;
        return actualNum >= expectedNum && actualNum <= maxNum;
      }
      case "number-out-range": {
        const maxNum = Number(expectedMax);
        if (!isValidNumber(maxNum)) return false;
        return actualNum < expectedNum || actualNum > maxNum;
      }
      default:
        return false;
    }
  }

  private compareDateValue(
    actual: any,
    operator: PropertyOperator,
    expected: any,
    expectedMax?: any
  ): boolean {
    // Parse actual date
    let actualTimestamp: number;
    if (typeof actual === "number") {
      actualTimestamp = actual;
    } else if (actual instanceof Date) {
      actualTimestamp = actual.getTime();
    } else {
      const parsed = parseSmartDate(String(actual));
      if (parsed === null) return false;
      actualTimestamp = parsed;
    }

    // Parse expected date
    const expectedTimestamp = parseSmartDate(String(expected));
    if (expectedTimestamp === null) return false;

    switch (operator) {
      case "date-eq":
        return isSameDay(actualTimestamp, expectedTimestamp);
      case "date-before":
        return actualTimestamp < expectedTimestamp;
      case "date-after":
        return actualTimestamp > expectedTimestamp;
      case "date-in-range": {
        const maxTimestamp = parseSmartDate(String(expectedMax));
        if (maxTimestamp === null) return false;
        return actualTimestamp >= expectedTimestamp && actualTimestamp <= maxTimestamp;
      }
      case "date-out-range": {
        const maxTimestamp = parseSmartDate(String(expectedMax));
        if (maxTimestamp === null) return false;
        return actualTimestamp < expectedTimestamp || actualTimestamp > maxTimestamp;
      }
      case "date-older-than-days": {
        const days = Number(expected);
        if (!isValidNumber(days)) return false;
        return getAgeInDays(actualTimestamp) > days;
      }
      case "date-within-days": {
        const days = Number(expected);
        if (!isValidNumber(days)) return false;
        return getAgeInDays(actualTimestamp) <= days;
      }
      default:
        return false;
    }
  }

  private compareBooleanValue(actual: any, operator: PropertyOperator): boolean {
    const actualBool = Boolean(actual);

    switch (operator) {
      case "is-true":
        return actualBool === true;
      case "is-false":
        return actualBool === false;
      default:
        return false;
    }
  }

  private compareArrayValue(actual: any, operator: PropertyOperator, expected: any): boolean {
    if (!Array.isArray(actual)) {
      return false; // Not an array
    }

    switch (operator) {
      case "array-contains": {
        const expectedStr = String(expected).toLowerCase();
        return actual.some((item) => String(item).toLowerCase() === expectedStr);
      }
      case "array-contains-all": {
        // Expected can be a comma-separated list
        const expectedItems = String(expected)
          .split(",")
          .map((s) => s.trim().toLowerCase());
        return expectedItems.every((expectedItem) =>
          actual.some((item) => String(item).toLowerCase() === expectedItem)
        );
      }
      case "array-is-empty":
        return actual.length === 0;
      case "array-not-empty":
        return actual.length > 0;
      default:
        return false;
    }
  }

  // ============================================================================
  // File Path Filter
  // ============================================================================

  private evaluateFilePathFilter(file: TFile, filter: FilePathFilter): boolean {
    if (!filter.pattern || filter.pattern.trim() === "") {
      return false; // Invalid filter
    }

    if (filter.matchMode === "wildcard") {
      return matchWildcard(file.path, filter.pattern);
    } else if (filter.matchMode === "regex") {
      try {
        const regex = new RegExp(filter.pattern);
        return regex.test(file.path);
      } catch {
        return false; // Invalid regex
      }
    }

    return false;
  }

  // ============================================================================
  // File Size Filter
  // ============================================================================

  private evaluateFileSizeFilter(file: TFile, filter: FileSizeFilter): boolean {
    const size = file.stat.size;

    if (!isValidNumber(filter.value)) {
      return false; // Invalid filter
    }

    switch (filter.operator) {
      case "lt":
        return size < filter.value;
      case "lte":
        return size <= filter.value;
      case "gt":
        return size > filter.value;
      case "gte":
        return size >= filter.value;
      case "in-range":
        if (!isValidNumber(filter.valueMax)) return false;
        return size >= filter.value && size <= filter.valueMax!;
      case "out-range":
        if (!isValidNumber(filter.valueMax)) return false;
        return size < filter.value || size > filter.valueMax!;
      default:
        return false;
    }
  }

  // ============================================================================
  // File Date Filter
  // ============================================================================

  private evaluateFileDateFilter(file: TFile, filter: FileDateFilter): boolean {
    const timestamp = filter.type === "file-ctime" ? file.stat.ctime : file.stat.mtime;

    const expectedTimestamp = parseSmartDate(filter.value);
    if (expectedTimestamp === null) {
      return false; // Invalid date
    }

    switch (filter.operator) {
      case "before":
        return timestamp < expectedTimestamp;
      case "after":
        return timestamp > expectedTimestamp;
      case "on":
        return isSameDay(timestamp, expectedTimestamp);
      case "in-range": {
        if (!filter.valueMax) return false;
        const maxTimestamp = parseSmartDate(filter.valueMax);
        if (maxTimestamp === null) return false;
        return timestamp >= expectedTimestamp && timestamp <= maxTimestamp;
      }
      case "out-range": {
        if (!filter.valueMax) return false;
        const maxTimestamp = parseSmartDate(filter.valueMax);
        if (maxTimestamp === null) return false;
        return timestamp < expectedTimestamp || timestamp > maxTimestamp;
      }
      case "older-than-days": {
        const days = Number(filter.value);
        if (!isValidNumber(days)) return false;
        return getAgeInDays(timestamp) > days;
      }
      case "within-days": {
        const days = Number(filter.value);
        if (!isValidNumber(days)) return false;
        return getAgeInDays(timestamp) <= days;
      }
      default:
        return false;
    }
  }

  // ============================================================================
  // Link Count Filter
  // ============================================================================

  private evaluateLinkCountFilter(file: TFile, filter: LinkCountFilter): boolean {
    if (!isValidNumber(filter.value)) {
      return false; // Invalid filter
    }

    const metadata = this.app.metadataCache.getFileCache(file);
    if (!metadata) {
      return false; // No metadata
    }

    let count: number;

    if (filter.linkType === "outlinks") {
      // Count outlinks (links + embeds)
      const links = metadata.links?.length ?? 0;
      const embeds = metadata.embeds?.length ?? 0;
      count = links + embeds;
    } else {
      // Count backlinks
      // Note: Obsidian doesn't provide a direct API for backlinks count
      // We need to check all files and see which ones link to this file
      const allFiles = this.app.vault.getMarkdownFiles();
      count = 0;

      for (const otherFile of allFiles) {
        if (otherFile === file) continue;

        const otherMetadata = this.app.metadataCache.getFileCache(otherFile);
        if (!otherMetadata) continue;

        // Check if this file links to our target file
        const hasLink =
          otherMetadata.links?.some(link => {
            const linkedFile = this.app.metadataCache.getFirstLinkpathDest(link.link, otherFile.path);
            return linkedFile?.path === file.path;
          }) ||
          otherMetadata.embeds?.some(embed => {
            const linkedFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, otherFile.path);
            return linkedFile?.path === file.path;
          });

        if (hasLink) {
          count++;
        }
      }
    }

    switch (filter.operator) {
      case "eq":
        return count === filter.value;
      case "lt":
        return count < filter.value;
      case "lte":
        return count <= filter.value;
      case "gt":
        return count > filter.value;
      case "gte":
        return count >= filter.value;
      default:
        return false;
    }
  }

  // ============================================================================
  // Bookmark Filter
  // ============================================================================

  private evaluateBookmarkFilter(file: TFile, filter: BookmarkFilter): boolean {
    // Check if file is bookmarked
    const bookmarksPlugin = (this.app as any).internalPlugins?.plugins?.bookmarks;

    if (!bookmarksPlugin || !bookmarksPlugin.enabled) {
      // Bookmarks plugin not available - no files are bookmarked
      return filter.isBookmarked === false;
    }

    const bookmarkItems = bookmarksPlugin.instance?.items ?? [];
    const isBookmarked = bookmarkItems.some(
      (item: any) => item.type === "file" && item.path === file.path
    );

    return isBookmarked === filter.isBookmarked;
  }
}
