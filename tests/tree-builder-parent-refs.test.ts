import { describe, it, expect, beforeEach } from "vitest";
import { TreeBuilder } from "../src/tree/tree-builder";
import { VaultIndexer } from "../src/indexer/vault-indexer";
import { App, TFile } from "obsidian";
import { HierarchyConfig } from "../src/types/hierarchy-config";

describe("TreeBuilder - Parent References", () => {
  let app: App;
  let indexer: VaultIndexer;
  let builder: TreeBuilder;

  beforeEach(() => {
    // Mock app
    app = {
      vault: {
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        on: () => {},
        off: () => {},
      },
    } as unknown as App;

    indexer = new VaultIndexer(app);
    builder = new TreeBuilder(app, indexer);
  });

  it("should set parent references for nested property nodes", async () => {
    // Create mock files with properties
    const file1 = {
      path: "file1.md",
      basename: "file1",
    } as TFile;

    const file2 = {
      path: "file2.md",
      basename: "file2",
    } as TFile;

    // Mock the indexer methods
    indexer.getAllFiles = () => [file1, file2];
    indexer.getFileTags = () => new Set();
    indexer.getFileProperties = (file: TFile) => {
      if (file === file1) {
        return { status: "active", priority: "high" };
      } else {
        return { status: "active", priority: "low" };
      }
    };

    // Create hierarchy config: status > priority
    const config: HierarchyConfig = {
      name: "Test Hierarchy",
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
      ],
      showPartialMatches: false,
    };

    // Build tree
    const tree = builder.buildFromHierarchy(config);

    // Verify structure: root > status=active > priority=high/low
    expect(tree.children.length).toBe(1); // One status group

    const statusNode = tree.children[0];
    expect(statusNode.metadata?.propertyKey).toBe("status");
    expect(statusNode.metadata?.propertyValue).toBe("active");
    expect(statusNode.parent).toBeUndefined(); // Root's children don't have parent set to root

    // Check that status node has priority children
    const priorityNodes = statusNode.children.filter(
      (n) => n.type === "property-group"
    );
    expect(priorityNodes.length).toBeGreaterThan(0);

    // Verify parent references for priority nodes
    for (const priorityNode of priorityNodes) {
      expect(priorityNode.parent).toBe(statusNode);
      expect(priorityNode.metadata?.propertyKey).toBe("priority");
    }
  });

  it("should set parent references for mixed property and tag nodes", async () => {
    // Create mock files
    const file1 = {
      path: "file1.md",
      basename: "file1",
    } as TFile;

    // Mock the indexer methods
    indexer.getAllFiles = () => [file1];
    indexer.getFileTags = () => new Set(["project/backend"]);
    indexer.getFileProperties = () => ({
      status: "active",
    });

    // Create hierarchy config: status > tag
    const config: HierarchyConfig = {
      name: "Test Hierarchy",
      levels: [
        {
          type: "property",
          key: "status",
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
    };

    // Build tree
    const tree = builder.buildFromHierarchy(config);

    // Find the tag nodes under the property node
    const statusNode = tree.children[0];
    expect(statusNode.metadata?.propertyKey).toBe("status");

    // Find tag nodes (may be nested)
    function findTagNodes(node: any, tagNodes: any[] = []): any[] {
      if (node.type === "tag") {
        tagNodes.push(node);
      }
      for (const child of node.children) {
        findTagNodes(child, tagNodes);
      }
      return tagNodes;
    }

    const tagNodes = findTagNodes(statusNode);
    expect(tagNodes.length).toBeGreaterThan(0);

    // Verify that all tag nodes have parent references
    for (const tagNode of tagNodes) {
      expect(tagNode.parent).toBeDefined();
      expect(tagNode.parent).not.toBeNull();
    }
  });

  it("should set parent references for file nodes", async () => {
    // Create mock file
    const file1 = {
      path: "file1.md",
      basename: "file1",
    } as TFile;

    // Mock the indexer methods
    indexer.getAllFiles = () => [file1];
    indexer.getFileTags = () => new Set();
    indexer.getFileProperties = () => ({
      status: "active",
    });

    // Create simple hierarchy config
    const config: HierarchyConfig = {
      name: "Test Hierarchy",
      levels: [
        {
          type: "property",
          key: "status",
          separateListValues: true,
          showPropertyName: false,
        },
      ],
      showPartialMatches: false,
    };

    // Build tree
    const tree = builder.buildFromHierarchy(config);

    // Find file nodes
    function findFileNodes(node: any, fileNodes: any[] = []): any[] {
      if (node.type === "file") {
        fileNodes.push(node);
      }
      for (const child of node.children) {
        findFileNodes(child, fileNodes);
      }
      return fileNodes;
    }

    const fileNodes = findFileNodes(tree);
    expect(fileNodes.length).toBe(1);

    // Verify file node has parent reference
    const fileNode = fileNodes[0];
    expect(fileNode.parent).toBeDefined();
    expect(fileNode.parent).not.toBeNull();
    expect(fileNode.parent?.type).toBe("property-group");
  });
});
