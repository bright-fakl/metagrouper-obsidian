import { SortMode, FileSortMode } from "./view-state";
import { FilterConfig } from "./filters";

/**
 * Level color modes for visual hierarchy differentiation
 */
export type LevelColorMode = "none" | "background" | "border" | "icon";

/**
 * Base hierarchy level interface
 */
interface BaseHierarchyLevel {
  /** Optional display name override (defaults to key) */
  label?: string;

  /** Optional sort mode for this level (defaults to parent config's sort mode) */
  sortBy?: SortMode;

  /** Optional custom color for this level (CSS color value) */
  color?: string;
}

/**
 * Tag-based hierarchy level
 * Groups files by tags starting with the specified key
 */
export interface TagHierarchyLevel extends BaseHierarchyLevel {
  type: "tag";

  /** Tag prefix to match (empty string matches all base tags) */
  key: string;

  /**
   * Number of tag levels to span
   * - 1: Single level (e.g., "project" but not "project/alpha")
   * - 2+: Multiple levels (e.g., 2 = "project" and "project/alpha")
   * - -1: Unlimited depth - show full nested hierarchy (default for simple tag views)
   */
  depth: number;

  /** Whether to insert next hierarchy level after each intermediate tag level */
  virtual: boolean;

  /** Whether to show full tag path or just last segment */
  showFullPath: boolean;
}

/**
 * Property-based hierarchy level
 * Groups files by frontmatter property values
 */
export interface PropertyHierarchyLevel extends BaseHierarchyLevel {
  type: "property";

  /** Property name to group by */
  key: string;

  /** Whether to treat list properties as separate values (true) or single value (false) */
  separateListValues: boolean;

  /** Whether to prepend property name to value (e.g., "status = active") */
  showPropertyName: boolean;
}

/**
 * Union type for all hierarchy levels
 */
export type HierarchyLevel = TagHierarchyLevel | PropertyHierarchyLevel;

/**
 * Configuration for a custom hierarchy view
 *
 * Defines how to build a multi-level tree structure from vault files
 * by combining tag-based and property-based grouping.
 */
export interface HierarchyConfig {
  /** Unique name for this view configuration */
  name: string;

  /** Optional filters to restrict which files are shown in this view */
  filters?: FilterConfig;

  /** Ordered list of hierarchy levels (top to bottom) */
  levels: HierarchyLevel[];

  /** Whether to show files that don't match all hierarchy levels */
  showPartialMatches: boolean;

  /** Default expansion depth (0 = collapsed, -1 = fully expanded) */
  defaultExpanded?: number;

  /** Default sort mode for tag/property nodes (can be overridden per level) */
  defaultNodeSortMode?: SortMode;

  /** Default sort mode for file nodes */
  defaultFileSortMode?: FileSortMode;

  /** How to apply level colors (none, background, border, or icon) */
  levelColorMode?: LevelColorMode;

  /** Optional custom color for file nodes (CSS color value) */
  fileColor?: string;

  /** Filter types to expose in toolbar (for quick overrides) */
  toolbarFilterTypes?: import("./filters").FilterType[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Default values for hierarchy configuration
 */
export const DEFAULT_HIERARCHY_CONFIG: Partial<HierarchyConfig> = {
  showPartialMatches: false,
  defaultExpanded: 1,
  defaultNodeSortMode: "alpha-asc",
  defaultFileSortMode: "alpha-asc",
};

/**
 * Default values for tag hierarchy level
 */
export const DEFAULT_TAG_LEVEL: Partial<TagHierarchyLevel> = {
  depth: -1, // -1 = unlimited depth (show full nested hierarchy)
  virtual: false,
  showFullPath: false,
  sortBy: undefined, // Inherits from parent config
};

/**
 * Default values for property hierarchy level
 */
export const DEFAULT_PROPERTY_LEVEL: Partial<PropertyHierarchyLevel> = {
  separateListValues: true,
  showPropertyName: false,
  sortBy: undefined, // Inherits from parent config
};

/**
 * Validates a HierarchyLevel object
 *
 * @param level - The hierarchy level to validate
 * @returns Validation result with any errors
 */
export function validateHierarchyLevel(
  level: any
): ValidationResult {
  const errors: string[] = [];

  // Check if level is an object
  if (typeof level !== "object" || level === null) {
    errors.push("Hierarchy level must be an object");
    return { valid: false, errors };
  }

  // Validate type
  if (!level.type) {
    errors.push("Hierarchy level must have a 'type' field");
  } else if (level.type !== "tag" && level.type !== "property") {
    errors.push(
      `Invalid hierarchy level type: '${level.type}'. Must be 'tag' or 'property'`
    );
  }

  // Validate key
  if (level.key === undefined || level.key === null) {
    errors.push("Hierarchy level must have a 'key' field");
  } else if (typeof level.key !== "string") {
    errors.push("Hierarchy level 'key' must be a string");
  }
  // Note: Empty string is valid for tag keys (matches all base tags)

  // Type-specific validation
  if (level.type === "tag") {
    // Validate depth
    if (level.depth !== undefined) {
      if (typeof level.depth !== "number") {
        errors.push("Tag level 'depth' must be a number");
      } else if (!Number.isInteger(level.depth) || (level.depth < 1 && level.depth !== -1)) {
        errors.push("Tag level 'depth' must be an integer >= 1 or -1 for unlimited depth");
      }
    }

    // Validate virtual
    if (level.virtual !== undefined && typeof level.virtual !== "boolean") {
      errors.push("Tag level 'virtual' must be a boolean");
    }

    // Validate showFullPath
    if (level.showFullPath !== undefined && typeof level.showFullPath !== "boolean") {
      errors.push("Tag level 'showFullPath' must be a boolean");
    }
  } else if (level.type === "property") {
    // Validate separateListValues
    if (level.separateListValues !== undefined && typeof level.separateListValues !== "boolean") {
      errors.push("Property level 'separateListValues' must be a boolean");
    }

    // Validate showPropertyName
    if (level.showPropertyName !== undefined && typeof level.showPropertyName !== "boolean") {
      errors.push("Property level 'showPropertyName' must be a boolean");
    }

    // Property key cannot be empty
    if (typeof level.key === "string" && level.key.trim() === "") {
      errors.push("Property level 'key' cannot be empty");
    }
  }

  // Validate optional label
  if (level.label !== undefined) {
    if (typeof level.label !== "string") {
      errors.push("Hierarchy level 'label' must be a string");
    }
  }

  // Validate optional sortBy
  if (level.sortBy !== undefined) {
    const validSortModes: SortMode[] = [
      "alpha-asc",
      "alpha-desc",
      "count-desc",
      "count-asc",
      "none",
    ];
    if (!validSortModes.includes(level.sortBy)) {
      errors.push(
        `Invalid sort mode: '${level.sortBy}'. Must be one of: ${validSortModes.join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a HierarchyConfig object
 *
 * @param config - The hierarchy config to validate
 * @returns Validation result with any errors
 */
export function validateHierarchyConfig(
  config: any
): ValidationResult {
  const errors: string[] = [];

  // Check if config is an object
  if (typeof config !== "object" || config === null) {
    errors.push("Hierarchy config must be an object");
    return { valid: false, errors };
  }

  // Validate name
  if (!config.name) {
    errors.push("Hierarchy config must have a 'name' field");
  } else if (typeof config.name !== "string") {
    errors.push("Hierarchy config 'name' must be a string");
  } else if (config.name.trim() === "") {
    errors.push("Hierarchy config 'name' cannot be empty");
  }

  // Validate levels
  if (!config.levels) {
    errors.push("Hierarchy config must have a 'levels' field");
  } else if (!Array.isArray(config.levels)) {
    errors.push("Hierarchy config 'levels' must be an array");
  } else if (config.levels.length === 0) {
    errors.push("Hierarchy config must have at least one level");
  } else {
    // Validate each level
    config.levels.forEach((level: any, index: number) => {
      const levelResult = validateHierarchyLevel(level);
      if (!levelResult.valid) {
        levelResult.errors.forEach((error) => {
          errors.push(`Level ${index + 1}: ${error}`);
        });
      }
    });
  }

  // Validate optional defaultExpanded
  if (config.defaultExpanded !== undefined) {
    if (typeof config.defaultExpanded !== "number") {
      errors.push("Hierarchy config 'defaultExpanded' must be a number");
    } else if (
      config.defaultExpanded < -1 ||
      !Number.isInteger(config.defaultExpanded)
    ) {
      errors.push(
        "Hierarchy config 'defaultExpanded' must be an integer >= -1 (use -1 for fully expanded)"
      );
    }
  }

  // Validate showPartialMatches
  if (config.showPartialMatches !== undefined && typeof config.showPartialMatches !== "boolean") {
    errors.push("Hierarchy config 'showPartialMatches' must be a boolean");
  }

  // Validate optional defaultNodeSortMode
  if (config.defaultNodeSortMode !== undefined) {
    const validSortModes: SortMode[] = [
      "alpha-asc",
      "alpha-desc",
      "count-desc",
      "count-asc",
      "none",
    ];
    if (!validSortModes.includes(config.defaultNodeSortMode)) {
      errors.push(
        `Invalid default node sort mode: '${config.defaultNodeSortMode}'. Must be one of: ${validSortModes.join(", ")}`
      );
    }
  }

  // Validate optional defaultFileSortMode
  if (config.defaultFileSortMode !== undefined) {
    const validFileSortModes: FileSortMode[] = [
      "alpha-asc",
      "alpha-desc",
      "created-desc",
      "created-asc",
      "modified-desc",
      "modified-asc",
      "size-desc",
      "size-asc",
      "none",
    ];
    if (!validFileSortModes.includes(config.defaultFileSortMode)) {
      errors.push(
        `Invalid default file sort mode: '${config.defaultFileSortMode}'. Must be one of: ${validFileSortModes.join(", ")}`
      );
    }
  }

  // Validate that tag levels don't overlap
  if (Array.isArray(config.levels)) {
    // Build array of tag levels with their original indices
    const tagLevelsWithIndices = config.levels
      .map((level: any, index: number) => ({ level, index }))
      .filter(({ level }: { level: any }) => level.type === "tag");

    for (let i = 0; i < tagLevelsWithIndices.length; i++) {
      for (let j = i + 1; j < tagLevelsWithIndices.length; j++) {
        const { level: level1, index: index1 } = tagLevelsWithIndices[i];
        const { level: level2, index: index2 } = tagLevelsWithIndices[j];

        // Check if one key is a prefix of the other (including empty string)
        const key1 = level1.key || "";
        const key2 = level2.key || "";

        // Empty string overlaps with everything
        if (key1 === "" || key2 === "") {
          if (key1 !== key2) { // Both empty is OK (same key)
            const emptyLevelIndex = key1 === "" ? index1 : index2;
            const otherLevelIndex = key1 === "" ? index2 : index1;
            errors.push(
              `Level ${emptyLevelIndex + 1} (all tags) overlaps with Level ${otherLevelIndex + 1}. ` +
              `A level with key="" (all tags) cannot coexist with other tag levels.`
            );
          }
        } else if (key1.startsWith(key2 + "/") || key2.startsWith(key1 + "/") || key1 === key2) {
          errors.push(
            `Level ${index1 + 1} (tag key="${key1}") overlaps with Level ${index2 + 1} (tag key="${key2}"). ` +
            `Tag levels must be non-overlapping (e.g., "project" and "status" are OK, but "project" and "project/work" are not).`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a tag hierarchy level with default values
 *
 * @param level - Partial tag hierarchy level
 * @returns Complete tag hierarchy level with defaults applied
 */
export function createTagLevel(
  level: Partial<TagHierarchyLevel> & Pick<TagHierarchyLevel, "key">
): TagHierarchyLevel {
  return {
    type: "tag",
    ...DEFAULT_TAG_LEVEL,
    ...level,
  } as TagHierarchyLevel;
}

/**
 * Creates a property hierarchy level with default values
 *
 * @param level - Partial property hierarchy level
 * @returns Complete property hierarchy level with defaults applied
 */
export function createPropertyLevel(
  level: Partial<PropertyHierarchyLevel> & Pick<PropertyHierarchyLevel, "key">
): PropertyHierarchyLevel {
  return {
    type: "property",
    ...DEFAULT_PROPERTY_LEVEL,
    ...level,
  } as PropertyHierarchyLevel;
}

/**
 * Creates a hierarchy level with default values (factory function)
 *
 * @param level - Partial hierarchy level with type
 * @returns Complete hierarchy level with defaults applied
 */
export function createHierarchyLevel(
  level: Partial<HierarchyLevel> & Pick<HierarchyLevel, "type" | "key">
): HierarchyLevel {
  if (level.type === "tag") {
    return createTagLevel(level as Partial<TagHierarchyLevel> & Pick<TagHierarchyLevel, "key">);
  } else {
    return createPropertyLevel(level as Partial<PropertyHierarchyLevel> & Pick<PropertyHierarchyLevel, "key">);
  }
}

/**
 * Creates a hierarchy config with default values
 *
 * @param config - Partial hierarchy config
 * @returns Complete hierarchy config with defaults applied
 */
export function createHierarchyConfig(
  config: Partial<HierarchyConfig> & Pick<HierarchyConfig, "name" | "levels">
): HierarchyConfig {
  return {
    ...DEFAULT_HIERARCHY_CONFIG,
    ...config,
    showPartialMatches: config.showPartialMatches ?? false,
  };
}

/**
 * Example hierarchy configurations for common use cases
 */
export const EXAMPLE_HIERARCHY_CONFIGS: HierarchyConfig[] = [
  {
    name: "All Tags",
    levels: [
      {
        type: "tag",
        key: "",
        depth: -1, // Show full nested hierarchy
        virtual: false,
        showFullPath: false,
      }
    ],
    showPartialMatches: false,
    defaultExpanded: 2,
    defaultNodeSortMode: "alpha-asc",
    defaultFileSortMode: "alpha-asc",
  },
  {
    name: "Projects by Status",
    filters: {
      version: 2,
      filters: [
        {
          label: "A",
          filter: {
            id: "project-tag",
            type: "tag",
            tag: "project",
            matchMode: "prefix",
          },
        },
      ],
      expression: "A",
    },
    levels: [
      {
        type: "property",
        key: "status",
        label: "Status",
        separateListValues: true,
        showPropertyName: false,
      },
      {
        type: "property",
        key: "priority",
        label: "Priority",
        separateListValues: true,
        showPropertyName: false,
      },
      {
        type: "tag",
        key: "project",
        label: "Project",
        depth: 2,
        virtual: false,
        showFullPath: false,
      },
    ],
    showPartialMatches: false,
    defaultExpanded: 2,
    defaultNodeSortMode: "alpha-asc",
    defaultFileSortMode: "alpha-asc",
  },
  {
    name: "Research by Topic and Year",
    filters: {
      version: 2,
      filters: [
        {
          label: "A",
          filter: {
            id: "research-tag",
            type: "tag",
            tag: "research",
            matchMode: "prefix",
          },
        },
      ],
      expression: "A",
    },
    levels: [
      {
        type: "property",
        key: "topic",
        label: "Topic",
        separateListValues: true,
        showPropertyName: false,
      },
      {
        type: "property",
        key: "year",
        label: "Year",
        sortBy: "alpha-desc",
        separateListValues: false,
        showPropertyName: false,
      },
      {
        type: "tag",
        key: "research",
        label: "Subtopic",
        depth: 1,
        virtual: false,
        showFullPath: false,
      },
    ],
    showPartialMatches: false,
    defaultExpanded: 1,
    defaultNodeSortMode: "alpha-asc",
    defaultFileSortMode: "alpha-asc",
  },
  {
    name: "Tasks by Status and Project",
    filters: {
      version: 2,
      filters: [
        {
          label: "A",
          filter: {
            id: "task-tag",
            type: "tag",
            tag: "task",
            matchMode: "prefix",
          },
        },
      ],
      expression: "A",
    },
    levels: [
      {
        type: "property",
        key: "status",
        label: "Status",
        sortBy: "count-desc",
        separateListValues: true,
        showPropertyName: false,
      },
      {
        type: "property",
        key: "project",
        label: "Project",
        separateListValues: true,
        showPropertyName: false,
      },
    ],
    showPartialMatches: false,
    defaultExpanded: 1,
    defaultNodeSortMode: "count-desc",
    defaultFileSortMode: "alpha-asc",
  },
];
