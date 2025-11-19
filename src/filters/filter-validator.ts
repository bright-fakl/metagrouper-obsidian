import {
  FilterConfig,
  FilterGroup,
  Filter,
  TagFilter,
  PropertyExistsFilter,
  PropertyValueFilter,
  FilePathFilter,
  FileSizeFilter,
  FileDateFilter,
  LinkCountFilter,
  BookmarkFilter,
} from "../types/filters";
import { parseSmartDate, isValidNumber } from "./filter-utils";

/**
 * Validation result for filters
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  filterId: string;
  groupId?: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  filterId: string;
  groupId?: string;
  message: string;
}

/**
 * FilterValidator - Validates filter configurations
 *
 * Responsibilities:
 * - Validate filter structure and values
 * - Provide helpful error messages
 * - Warn about potential issues (e.g., property type changes)
 */
export class FilterValidator {
  /**
   * Validate a complete filter configuration
   */
  validate(filterConfig: FilterConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!filterConfig) {
      return { valid: true, errors: [], warnings: [] };
    }

    if (!filterConfig.groups || filterConfig.groups.length === 0) {
      // No groups is valid - means no filtering
      return { valid: true, errors: [], warnings: [] };
    }

    // Validate each group
    filterConfig.groups.forEach((group) => {
      this.validateGroup(group, errors, warnings);
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a filter group
   */
  private validateGroup(group: FilterGroup, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!group.id) {
      errors.push({
        filterId: "",
        groupId: group.id,
        message: "Filter group is missing an ID",
      });
      return;
    }

    if (!group.filters || group.filters.length === 0) {
      warnings.push({
        filterId: "",
        groupId: group.id,
        message: "Filter group is empty",
      });
      return;
    }

    // Validate each filter in the group
    group.filters.forEach((filter) => {
      this.validateFilter(filter, group.id, errors, warnings);
    });
  }

  /**
   * Validate a single filter
   */
  private validateFilter(
    filter: Filter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.id) {
      errors.push({
        filterId: "",
        groupId,
        message: "Filter is missing an ID",
      });
      return;
    }

    // Validate based on filter type
    switch (filter.type) {
      case "tag":
        this.validateTagFilter(filter, groupId, errors, warnings);
        break;
      case "property-exists":
        this.validatePropertyExistsFilter(filter, groupId, errors, warnings);
        break;
      case "property-value":
        this.validatePropertyValueFilter(filter, groupId, errors, warnings);
        break;
      case "file-path":
        this.validateFilePathFilter(filter, groupId, errors, warnings);
        break;
      case "file-size":
        this.validateFileSizeFilter(filter, groupId, errors, warnings);
        break;
      case "file-ctime":
      case "file-mtime":
        this.validateFileDateFilter(filter, groupId, errors, warnings);
        break;
      case "link-count":
        this.validateLinkCountFilter(filter, groupId, errors, warnings);
        break;
      case "bookmark":
        this.validateBookmarkFilter(filter, groupId, errors, warnings);
        break;
      default:
        errors.push({
          filterId: filter.id,
          groupId,
          message: `Unknown filter type: ${(filter as any).type}`,
        });
    }
  }

  // ============================================================================
  // Individual Filter Validators
  // ============================================================================

  private validateTagFilter(
    filter: TagFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.tag || filter.tag.trim() === "") {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "tag",
        message: "Tag filter requires a tag name",
      });
    }

    if (!filter.matchMode) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "matchMode",
        message: "Tag filter requires a match mode",
      });
    }
  }

  private validatePropertyExistsFilter(
    filter: PropertyExistsFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.property || filter.property.trim() === "") {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "property",
        message: "Property filter requires a property name",
      });
    }
  }

  private validatePropertyValueFilter(
    filter: PropertyValueFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.property || filter.property.trim() === "") {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "property",
        message: "Property value filter requires a property name",
      });
      return;
    }

    if (!filter.operator) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "operator",
        message: "Property value filter requires an operator",
      });
      return;
    }

    // Check if value is required for this operator
    const operatorsNotNeedingValue = ["is-true", "is-false", "array-is-empty", "array-not-empty"];
    if (!operatorsNotNeedingValue.includes(filter.operator)) {
      if (filter.value === undefined || filter.value === null || filter.value === "") {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "value",
          message: "Property value filter requires a value",
        });
      }
    }

    // Check if valueMax is required for range operators
    const rangeOperators = ["number-in-range", "number-out-range", "date-in-range", "date-out-range"];
    if (rangeOperators.includes(filter.operator)) {
      if (filter.valueMax === undefined || filter.valueMax === null || filter.valueMax === "") {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "valueMax",
          message: "Range operator requires a maximum value",
        });
      }
    }

    // Validate value based on operator type
    if (filter.operator.startsWith("number-")) {
      if (filter.value !== undefined && filter.value !== null && filter.value !== "") {
        if (!isValidNumber(filter.value)) {
          errors.push({
            filterId: filter.id,
            groupId,
            field: "value",
            message: "Number operator requires a numeric value",
          });
        }
      }
      if (rangeOperators.includes(filter.operator) && filter.valueMax !== undefined) {
        if (!isValidNumber(filter.valueMax)) {
          errors.push({
            filterId: filter.id,
            groupId,
            field: "valueMax",
            message: "Number range requires a numeric maximum value",
          });
        }
      }
    }

    if (filter.operator.startsWith("date-")) {
      if (filter.value !== undefined && filter.value !== null && filter.value !== "") {
        const parsed = parseSmartDate(String(filter.value));
        if (parsed === null) {
          errors.push({
            filterId: filter.id,
            groupId,
            field: "value",
            message: "Invalid date format",
          });
        }
      }
      if (rangeOperators.includes(filter.operator) && filter.valueMax !== undefined) {
        const parsedMax = parseSmartDate(String(filter.valueMax));
        if (parsedMax === null) {
          errors.push({
            filterId: filter.id,
            groupId,
            field: "valueMax",
            message: "Invalid maximum date format",
          });
        }
      }
    }

    if (filter.operator === "matches-regex") {
      try {
        new RegExp(String(filter.value));
      } catch {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "value",
          message: "Invalid regular expression",
        });
      }
    }

    // Warn if property type is not specified and might be needed
    if (!filter.valueType) {
      warnings.push({
        filterId: filter.id,
        groupId,
        message: "Property type not specified - will be auto-detected",
      });
    }
  }

  private validateFilePathFilter(
    filter: FilePathFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.pattern || filter.pattern.trim() === "") {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "pattern",
        message: "File path filter requires a pattern",
      });
    }

    if (!filter.matchMode) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "matchMode",
        message: "File path filter requires a match mode",
      });
    }

    // Validate regex if using regex mode
    if (filter.matchMode === "regex" && filter.pattern) {
      try {
        new RegExp(filter.pattern);
      } catch {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "pattern",
          message: "Invalid regular expression",
        });
      }
    }
  }

  private validateFileSizeFilter(
    filter: FileSizeFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.operator) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "operator",
        message: "File size filter requires an operator",
      });
    }

    if (!isValidNumber(filter.value)) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "value",
        message: "File size filter requires a numeric value",
      });
    }

    const rangeOperators = ["in-range", "out-range"];
    if (rangeOperators.includes(filter.operator)) {
      if (!isValidNumber(filter.valueMax)) {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "valueMax",
          message: "Size range requires a maximum value",
        });
      }
    }
  }

  private validateFileDateFilter(
    filter: FileDateFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.operator) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "operator",
        message: "Date filter requires an operator",
      });
    }

    if (!filter.value || filter.value.trim() === "") {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "value",
        message: "Date filter requires a value",
      });
      return;
    }

    // For relative day operators, expect a number
    const relativeDayOperators = ["older-than-days", "within-days"];
    if (relativeDayOperators.includes(filter.operator)) {
      if (!isValidNumber(filter.value)) {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "value",
          message: "Relative day operator requires a number of days",
        });
      }
    } else {
      // For other operators, validate date format
      const parsed = parseSmartDate(filter.value);
      if (parsed === null) {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "value",
          message: "Invalid date format",
        });
      }
    }

    // Validate range operators
    const rangeOperators = ["in-range", "out-range"];
    if (rangeOperators.includes(filter.operator)) {
      if (!filter.valueMax || filter.valueMax.trim() === "") {
        errors.push({
          filterId: filter.id,
          groupId,
          field: "valueMax",
          message: "Date range requires a maximum date",
        });
      } else {
        const parsedMax = parseSmartDate(filter.valueMax);
        if (parsedMax === null) {
          errors.push({
            filterId: filter.id,
            groupId,
            field: "valueMax",
            message: "Invalid maximum date format",
          });
        }
      }
    }
  }

  private validateLinkCountFilter(
    filter: LinkCountFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!filter.linkType) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "linkType",
        message: "Link count filter requires a link type",
      });
    }

    if (!filter.operator) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "operator",
        message: "Link count filter requires an operator",
      });
    }

    if (!isValidNumber(filter.value)) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "value",
        message: "Link count filter requires a numeric value",
      });
    }
  }

  private validateBookmarkFilter(
    filter: BookmarkFilter,
    groupId: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (filter.isBookmarked === undefined || filter.isBookmarked === null) {
      errors.push({
        filterId: filter.id,
        groupId,
        field: "isBookmarked",
        message: "Bookmark filter requires a boolean value",
      });
    }
  }
}
