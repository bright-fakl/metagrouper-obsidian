/**
 * Filter types and interfaces for filtering files in saved views
 */

// ============================================================================
// Filter Configuration
// ============================================================================

export interface FilterConfig {
  version: 1;
  groups: FilterGroup[];
  combineWithOr: boolean; // true = OR between groups, false = AND
}

export interface FilterGroup {
  id: string;
  name?: string;
  filters: Filter[];
  enabled?: boolean;
}

// ============================================================================
// Base Filter
// ============================================================================

export interface BaseFilter {
  id: string;
  type: FilterType;
  negate?: boolean; // NOT operator
  enabled?: boolean;
}

export type FilterType =
  | "tag"
  | "property-exists"
  | "property-value"
  | "file-path"
  | "file-size"
  | "file-ctime"
  | "file-mtime"
  | "link-count"
  | "bookmark";

// ============================================================================
// Specific Filter Types
// ============================================================================

export interface TagFilter extends BaseFilter {
  type: "tag";
  tag: string; // e.g., "project" or "project/backend"
  matchMode: "exact" | "prefix" | "contains";
  // exact: only #project
  // prefix: #project and #project/*
  // contains: any tag containing "project"
}

export interface PropertyExistsFilter extends BaseFilter {
  type: "property-exists";
  property: string;
}

export interface PropertyValueFilter extends BaseFilter {
  type: "property-value";
  property: string;
  operator: PropertyOperator;
  value: any;
  valueMax?: any; // For range operators
  valueType?: PropertyValueType; // User-specified if property not registered
}

export type PropertyValueType = "string" | "number" | "date" | "boolean" | "array";

export type PropertyOperator =
  // String operators
  | "equals"
  | "not-equals"
  | "contains"
  | "not-contains"
  | "starts-with"
  | "ends-with"
  | "matches-regex"
  // Number operators
  | "number-eq"
  | "number-lt"
  | "number-lte"
  | "number-gt"
  | "number-gte"
  | "number-in-range"
  | "number-out-range"
  // Date operators
  | "date-eq"
  | "date-before"
  | "date-after"
  | "date-in-range"
  | "date-out-range"
  | "date-older-than-days"
  | "date-within-days"
  // Boolean operators
  | "is-true"
  | "is-false"
  // Array operators
  | "array-contains"
  | "array-contains-all"
  | "array-is-empty"
  | "array-not-empty";

export interface FilePathFilter extends BaseFilter {
  type: "file-path";
  pattern: string; // e.g., "Projects/*", "**/Archive/*"
  matchMode: "wildcard" | "regex";
}

export interface FileSizeFilter extends BaseFilter {
  type: "file-size";
  operator: "lt" | "lte" | "gt" | "gte" | "in-range" | "out-range";
  value: number; // in bytes
  valueMax?: number; // for range operators
}

export interface FileDateFilter extends BaseFilter {
  type: "file-ctime" | "file-mtime";
  operator:
    | "before"
    | "after"
    | "on"
    | "in-range"
    | "out-range"
    | "older-than-days"
    | "within-days";
  value: string; // Smart date string (parsed in evaluator)
  valueMax?: string; // for range operators
}

export interface LinkCountFilter extends BaseFilter {
  type: "link-count";
  linkType: "outlinks" | "backlinks";
  operator: "eq" | "lt" | "lte" | "gt" | "gte";
  value: number;
}

export interface BookmarkFilter extends BaseFilter {
  type: "bookmark";
  isBookmarked: boolean;
}

// ============================================================================
// Union Type
// ============================================================================

export type Filter =
  | TagFilter
  | PropertyExistsFilter
  | PropertyValueFilter
  | FilePathFilter
  | FileSizeFilter
  | FileDateFilter
  | LinkCountFilter
  | BookmarkFilter;

// ============================================================================
// Filter Metadata (for UI)
// ============================================================================

export interface FilterTypeMetadata {
  type: FilterType;
  name: string;
  description: string;
  icon: string;
}

export const FILTER_TYPE_METADATA: Record<FilterType, FilterTypeMetadata> = {
  tag: {
    type: "tag",
    name: "Tag",
    description: "Filter by tags (e.g., #project, #work)",
    icon: "tag",
  },
  "property-exists": {
    type: "property-exists",
    name: "Property Exists",
    description: "Filter by property existence",
    icon: "list-checks",
  },
  "property-value": {
    type: "property-value",
    name: "Property Value",
    description: "Filter by property value",
    icon: "file-text",
  },
  "file-path": {
    type: "file-path",
    name: "File Path",
    description: "Filter by file path pattern",
    icon: "folder",
  },
  "file-size": {
    type: "file-size",
    name: "File Size",
    description: "Filter by file size",
    icon: "hard-drive",
  },
  "file-ctime": {
    type: "file-ctime",
    name: "Created Date",
    description: "Filter by file creation date",
    icon: "calendar-plus",
  },
  "file-mtime": {
    type: "file-mtime",
    name: "Modified Date",
    description: "Filter by file modification date",
    icon: "calendar",
  },
  "link-count": {
    type: "link-count",
    name: "Link Count",
    description: "Filter by number of links",
    icon: "link",
  },
  bookmark: {
    type: "bookmark",
    name: "Bookmark",
    description: "Filter by bookmark status",
    icon: "bookmark",
  },
};

// ============================================================================
// Operator Metadata (for UI)
// ============================================================================

export interface OperatorMetadata {
  operator: string;
  label: string;
  needsValue: boolean;
  needsValueMax?: boolean; // For range operators
}

export const STRING_OPERATORS: OperatorMetadata[] = [
  { operator: "equals", label: "equals", needsValue: true },
  { operator: "not-equals", label: "not equals", needsValue: true },
  { operator: "contains", label: "contains", needsValue: true },
  { operator: "not-contains", label: "does not contain", needsValue: true },
  { operator: "starts-with", label: "starts with", needsValue: true },
  { operator: "ends-with", label: "ends with", needsValue: true },
  { operator: "matches-regex", label: "matches regex", needsValue: true },
];

export const NUMBER_OPERATORS: OperatorMetadata[] = [
  { operator: "number-eq", label: "=", needsValue: true },
  { operator: "number-lt", label: "<", needsValue: true },
  { operator: "number-lte", label: "≤", needsValue: true },
  { operator: "number-gt", label: ">", needsValue: true },
  { operator: "number-gte", label: "≥", needsValue: true },
  {
    operator: "number-in-range",
    label: "in range",
    needsValue: true,
    needsValueMax: true,
  },
  {
    operator: "number-out-range",
    label: "out of range",
    needsValue: true,
    needsValueMax: true,
  },
];

export const DATE_OPERATORS: OperatorMetadata[] = [
  { operator: "date-eq", label: "on", needsValue: true },
  { operator: "date-before", label: "before", needsValue: true },
  { operator: "date-after", label: "after", needsValue: true },
  {
    operator: "date-in-range",
    label: "in range",
    needsValue: true,
    needsValueMax: true,
  },
  {
    operator: "date-out-range",
    label: "out of range",
    needsValue: true,
    needsValueMax: true,
  },
  {
    operator: "date-older-than-days",
    label: "older than (days)",
    needsValue: true,
  },
  {
    operator: "date-within-days",
    label: "within last (days)",
    needsValue: true,
  },
];

export const BOOLEAN_OPERATORS: OperatorMetadata[] = [
  { operator: "is-true", label: "is true", needsValue: false },
  { operator: "is-false", label: "is false", needsValue: false },
];

export const ARRAY_OPERATORS: OperatorMetadata[] = [
  { operator: "array-contains", label: "contains", needsValue: true },
  { operator: "array-contains-all", label: "contains all", needsValue: true },
  { operator: "array-is-empty", label: "is empty", needsValue: false },
  { operator: "array-not-empty", label: "is not empty", needsValue: false },
];

export const SIZE_OPERATORS: OperatorMetadata[] = [
  { operator: "lt", label: "<", needsValue: true },
  { operator: "lte", label: "≤", needsValue: true },
  { operator: "gt", label: ">", needsValue: true },
  { operator: "gte", label: "≥", needsValue: true },
  {
    operator: "in-range",
    label: "in range",
    needsValue: true,
    needsValueMax: true,
  },
  {
    operator: "out-range",
    label: "out of range",
    needsValue: true,
    needsValueMax: true,
  },
];

export const LINK_COUNT_OPERATORS: OperatorMetadata[] = [
  { operator: "eq", label: "=", needsValue: true },
  { operator: "lt", label: "<", needsValue: true },
  { operator: "lte", label: "≤", needsValue: true },
  { operator: "gt", label: ">", needsValue: true },
  { operator: "gte", label: "≥", needsValue: true },
];
