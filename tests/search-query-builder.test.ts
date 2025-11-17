import { describe, it, expect } from "vitest";
import { SearchQueryBuilder } from "../src/utils/search-query-builder";
import { TreeNode } from "../src/types/tree-node";
import { HierarchyConfig } from "../src/types/hierarchy-config";

describe("SearchQueryBuilder", () => {
  // Helper to create a minimal hierarchy config for testing
  const createTestConfig = (): HierarchyConfig => ({
    name: "Test Config",
    levels: [
      {
        type: "property",
        key: "status",
        separateListValues: true,
        showPropertyName: false,
      },
      {
        type: "property",
        key: "priority",
        separateListValues: true,
        showPropertyName: false,
      },
      {
        type: "tag",
        key: "project",
        depth: -1,
        virtual: false,
        showFullPath: false,
      },
    ],
    showPartialMatches: false,
  });

  it("should build query for a single property node", () => {
    const config = createTestConfig();
    const builder = new SearchQueryBuilder(config);

    const node: TreeNode = {
      id: "prop:status:active",
      name: "active",
      type: "property-group",
      children: [],
      depth: 0,
      files: [],
      fileCount: 5,
      metadata: {
        propertyKey: "status",
        propertyValue: "active",
      },
    };

    const query = builder.buildQuery(node);
    expect(query).toBe("[status:active]");
  });

  it("should build query for nested property nodes (ancestor filters)", () => {
    const config = createTestConfig();
    const builder = new SearchQueryBuilder(config);

    // Create parent node: status = active
    const parentNode: TreeNode = {
      id: "prop:status:active",
      name: "active",
      type: "property-group",
      children: [],
      depth: 0,
      files: [],
      fileCount: 10,
      metadata: {
        propertyKey: "status",
        propertyValue: "active",
      },
    };

    // Create child node: priority = low
    const childNode: TreeNode = {
      id: "prop:status:active/prop:priority:low",
      name: "low",
      type: "property-group",
      children: [],
      depth: 1,
      files: [],
      fileCount: 5,
      metadata: {
        propertyKey: "priority",
        propertyValue: "low",
      },
      parent: parentNode,
    };

    parentNode.children.push(childNode);

    // Click on child node should include both filters
    const query = builder.buildQuery(childNode);
    expect(query).toBe("[status:active] [priority:low]");
  });

  it("should build query for tag node with ancestors", () => {
    const config = createTestConfig();
    const builder = new SearchQueryBuilder(config);

    // Create property node: status = active
    const statusNode: TreeNode = {
      id: "prop:status:active",
      name: "active",
      type: "property-group",
      children: [],
      depth: 0,
      files: [],
      fileCount: 15,
      metadata: {
        propertyKey: "status",
        propertyValue: "active",
      },
    };

    // Create tag node under status
    const tagNode: TreeNode = {
      id: "prop:status:active/tag:project/backend",
      name: "backend",
      type: "tag",
      children: [],
      depth: 1,
      files: [],
      fileCount: 8,
      metadata: {
        tagPath: "project/backend",
      },
      parent: statusNode,
    };

    statusNode.children.push(tagNode);

    // Click on tag should include property filter + tag filter
    const query = builder.buildQuery(tagNode);
    expect(query).toBe("[status:active] tag:#project/backend");
  });

  it("should build query for deeply nested nodes (3 levels)", () => {
    const config = createTestConfig();
    const builder = new SearchQueryBuilder(config);

    // Level 1: status = active
    const level1: TreeNode = {
      id: "prop:status:active",
      name: "active",
      type: "property-group",
      children: [],
      depth: 0,
      files: [],
      fileCount: 20,
      metadata: {
        propertyKey: "status",
        propertyValue: "active",
      },
    };

    // Level 2: priority = high
    const level2: TreeNode = {
      id: "prop:status:active/prop:priority:high",
      name: "high",
      type: "property-group",
      children: [],
      depth: 1,
      files: [],
      fileCount: 10,
      metadata: {
        propertyKey: "priority",
        propertyValue: "high",
      },
      parent: level1,
    };

    // Level 3: tag = project/backend/api
    const level3: TreeNode = {
      id: "prop:status:active/prop:priority:high/tag:project/backend/api",
      name: "api",
      type: "tag",
      children: [],
      depth: 2,
      files: [],
      fileCount: 5,
      metadata: {
        tagPath: "project/backend/api",
      },
      parent: level2,
    };

    level1.children.push(level2);
    level2.children.push(level3);

    // Click on deepest node should include all ancestor filters
    const query = builder.buildQuery(level3);
    expect(query).toBe("[status:active] [priority:high] tag:#project/backend/api");
  });

  it("should skip root node in query building", () => {
    const config = createTestConfig();
    const builder = new SearchQueryBuilder(config);

    // Create root node
    const rootNode: TreeNode = {
      id: "root",
      name: "root",
      type: "property-group",
      children: [],
      depth: -1,
      files: [],
      fileCount: 50,
    };

    // Create child node: status = active
    const childNode: TreeNode = {
      id: "prop:status:active",
      name: "active",
      type: "property-group",
      children: [],
      depth: 0,
      files: [],
      fileCount: 10,
      metadata: {
        propertyKey: "status",
        propertyValue: "active",
      },
      parent: rootNode,
    };

    rootNode.children.push(childNode);

    // Root node has no metadata, so it should not contribute to query
    const query = builder.buildQuery(childNode);
    expect(query).toBe("[status:active]");
  });

  it("should handle single tag node", () => {
    const config = createTestConfig();
    const builder = new SearchQueryBuilder(config);

    const tagNode: TreeNode = {
      id: "tag:project/backend",
      name: "backend",
      type: "tag",
      children: [],
      depth: 0,
      files: [],
      fileCount: 10,
      metadata: {
        tagPath: "project/backend",
      },
    };

    const query = builder.buildQuery(tagNode);
    expect(query).toBe("tag:#project/backend");
  });
});
