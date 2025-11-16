import { describe, it, expect, beforeEach } from "vitest";
import { App } from "obsidian";
import { VaultIndexer } from "../src/indexer/vault-indexer";
import { TreeBuilder } from "../src/tree/tree-builder";
import {
  createMockVault,
  clearMockVault,
  MockFileConfig,
} from "./helpers/mock-vault";

describe("TreeBuilder", () => {
  let app: App;
  let indexer: VaultIndexer;
  let builder: TreeBuilder;

  beforeEach(async () => {
    app = new App();
    clearMockVault(app);
    indexer = new VaultIndexer(app);
    builder = new TreeBuilder(indexer);
  });

  describe("Basic Tree Building", () => {
    it("should create a root node", async () => {
      createMockVault(app, []);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      expect(tree.id).toBe("root");
      expect(tree.name).toBe("Root");
      expect(tree.type).toBe("tag");
      expect(tree.depth).toBe(0);
    });

    it("should build tree from flat tags", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project"] },
        { path: "note2.md", tags: ["personal"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      expect(tree.children.length).toBe(2);
      expect(tree.children[0].name).toBe("personal");
      expect(tree.children[1].name).toBe("project");
    });

    it("should handle empty vault", async () => {
      createMockVault(app, []);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      expect(tree.children.length).toBe(0);
      expect(tree.fileCount).toBe(0);
    });
  });

  describe("Nested Tag Hierarchies", () => {
    it("should build nested structure from hierarchical tags", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
        { path: "note2.md", tags: ["project/beta"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      expect(tree.children.length).toBe(1);
      const projectNode = tree.children[0];
      expect(projectNode.name).toBe("project");
      expect(projectNode.children.length).toBe(2);
      expect(projectNode.children[0].name).toBe("alpha");
      expect(projectNode.children[1].name).toBe("beta");
    });

    it("should handle deeply nested tags", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["a/b/c/d"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const a = tree.children[0];
      expect(a.name).toBe("a");
      expect(a.depth).toBe(1);

      const b = a.children[0];
      expect(b.name).toBe("b");
      expect(b.depth).toBe(2);

      const c = b.children[0];
      expect(c.name).toBe("c");
      expect(c.depth).toBe(3);

      const d = c.children[0];
      expect(d.name).toBe("d");
      expect(d.depth).toBe(4);
    });

    it("should correctly set parent references", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      const alphaNode = projectNode.children[0];

      expect(projectNode.parent).toBe(tree);
      expect(alphaNode.parent).toBe(projectNode);
    });
  });

  describe("File Node Placement", () => {
    it("should add file nodes as children of tag nodes", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      expect(projectNode.children.length).toBe(1);

      const fileNode = projectNode.children[0];
      expect(fileNode.type).toBe("file");
      expect(fileNode.name).toBe("note1");
    });

    it("should place files at leaf tag nodes", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      const alphaNode = projectNode.children[0];

      // File should be under alpha, not project
      const fileNode = alphaNode.children[0];
      expect(fileNode.type).toBe("file");
      expect(fileNode.name).toBe("note1");
    });

    it("should handle multiple files under same tag", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project"] },
        { path: "note2.md", tags: ["project"] },
        { path: "note3.md", tags: ["project"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      expect(projectNode.children.length).toBe(3);

      const fileNodes = projectNode.children.filter((n) => n.type === "file");
      expect(fileNodes.length).toBe(3);
    });

    it("should handle files with multiple tags", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project", "important"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      expect(tree.children.length).toBe(2);

      // File should appear under both tags
      const importantNode = tree.children[0];
      const projectNode = tree.children[1];

      expect(importantNode.children.length).toBeGreaterThan(0);
      expect(projectNode.children.length).toBeGreaterThan(0);
    });
  });

  describe("File Count Aggregation", () => {
    it("should count files at leaf nodes", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project"] },
        { path: "note2.md", tags: ["project"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      expect(projectNode.fileCount).toBe(2);
    });

    it("should aggregate file counts from children", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
        { path: "note2.md", tags: ["project/beta"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      const alphaNode = projectNode.children[0];
      const betaNode = projectNode.children[1];

      expect(alphaNode.fileCount).toBe(1);
      expect(betaNode.fileCount).toBe(1);
      expect(projectNode.fileCount).toBe(2);
    });

    it("should calculate total file count at root", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
        { path: "note2.md", tags: ["project/beta"] },
        { path: "note3.md", tags: ["personal"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      expect(tree.fileCount).toBe(3);
    });

    it("should handle nested file counts correctly", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["a/b/c"] },
        { path: "note2.md", tags: ["a/b"] },
        { path: "note3.md", tags: ["a"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const a = tree.children[0];
      const b = a.children[0];
      const c = b.children[0];

      expect(c.fileCount).toBe(1); // note1.md
      expect(b.fileCount).toBe(2); // note1.md + note2.md
      expect(a.fileCount).toBe(3); // note1.md + note2.md + note3.md
    });
  });

  describe("Alphabetical Sorting", () => {
    it("should sort tag nodes alphabetically", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["zebra"] },
        { path: "note2.md", tags: ["alpha"] },
        { path: "note3.md", tags: ["beta"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      expect(tree.children[0].name).toBe("alpha");
      expect(tree.children[1].name).toBe("beta");
      expect(tree.children[2].name).toBe("zebra");
    });

    it("should sort file nodes alphabetically", async () => {
      const files: MockFileConfig[] = [
        { path: "zebra.md", tags: ["project"] },
        { path: "alpha.md", tags: ["project"] },
        { path: "beta.md", tags: ["project"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      const fileNodes = projectNode.children;

      expect(fileNodes[0].name).toBe("alpha");
      expect(fileNodes[1].name).toBe("beta");
      expect(fileNodes[2].name).toBe("zebra");
    });

    it("should sort tag nodes before file nodes", async () => {
      const files: MockFileConfig[] = [
        { path: "file1.md", tags: ["project"] },
        { path: "file2.md", tags: ["project/alpha"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];

      // First child should be tag node "alpha"
      expect(projectNode.children[0].type).toBe("tag");
      expect(projectNode.children[0].name).toBe("alpha");

      // Second child should be file node
      expect(projectNode.children[1].type).toBe("file");
    });

    it("should sort recursively through all levels", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/zebra"] },
        { path: "note2.md", tags: ["project/alpha"] },
        { path: "note3.md", tags: ["project/beta"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];

      expect(projectNode.children[0].name).toBe("alpha");
      expect(projectNode.children[1].name).toBe("beta");
      expect(projectNode.children[2].name).toBe("zebra");
    });
  });

  describe("Root Tag Filtering", () => {
    it("should filter by root tag", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
        { path: "note2.md", tags: ["project/beta"] },
        { path: "note3.md", tags: ["personal"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags("project");

      // Should only show tags under "project"
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe("project");

      const projectNode = tree.children[0];
      expect(projectNode.children.length).toBe(2);
      expect(projectNode.children[0].name).toBe("alpha");
      expect(projectNode.children[1].name).toBe("beta");
    });

    it("should handle non-existent root tag", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags("nonexistent");

      expect(tree.children.length).toBe(0);
      expect(tree.fileCount).toBe(0);
    });

    it("should include root tag itself when filtering", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project"] },
        { path: "note2.md", tags: ["project/alpha"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags("project");

      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe("project");
      expect(tree.children[0].fileCount).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle tags with similar prefixes", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["test"] },
        { path: "note2.md", tags: ["testing"] },
        { path: "note3.md", tags: ["test/nested"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      // Should create separate nodes for "test" and "testing"
      expect(tree.children.length).toBe(2);
      expect(tree.children[0].name).toBe("test");
      expect(tree.children[1].name).toBe("testing");
    });

    it("should handle case-insensitive tag sorting", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["Zebra"] },
        { path: "note2.md", tags: ["alpha"] },
        { path: "note3.md", tags: ["Beta"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      // Should be sorted case-insensitively
      expect(tree.children[0].name).toBe("alpha");
      expect(tree.children[1].name).toBe("beta");
      expect(tree.children[2].name).toBe("zebra");
    });

    it("should handle numeric sorting correctly", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["item10"] },
        { path: "note2.md", tags: ["item2"] },
        { path: "note3.md", tags: ["item1"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      // Should use natural/numeric sorting (item1, item2, item10)
      expect(tree.children[0].name).toBe("item1");
      expect(tree.children[1].name).toBe("item2");
      expect(tree.children[2].name).toBe("item10");
    });

    it("should handle mixed tag and file structure", async () => {
      const files: MockFileConfig[] = [
        { path: "root-file.md", tags: ["project"] },
        { path: "nested-file.md", tags: ["project/alpha"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];

      // Should have both tag child (alpha) and file child (root-file.md)
      const tagChildren = projectNode.children.filter((n) => n.type === "tag");
      const fileChildren = projectNode.children.filter(
        (n) => n.type === "file"
      );

      expect(tagChildren.length).toBe(1);
      expect(fileChildren.length).toBe(1);
    });

    it("should set correct metadata for tag nodes", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      expect(projectNode.metadata?.tagPath).toBe("project");

      const alphaNode = projectNode.children[0];
      expect(alphaNode.metadata?.tagPath).toBe("project/alpha");
    });

    it("should generate unique IDs for nodes", async () => {
      const files: MockFileConfig[] = [
        { path: "note1.md", tags: ["project/alpha"] },
      ];

      createMockVault(app, files);
      await indexer.initialize();

      const tree = builder.buildFromTags();

      const projectNode = tree.children[0];
      const alphaNode = projectNode.children[0];
      const fileNode = alphaNode.children[0];

      expect(projectNode.id).toBe("tag:project");
      expect(alphaNode.id).toBe("tag:project/alpha");
      expect(fileNode.id).toBe("file:note1.md");
    });
  });
});
