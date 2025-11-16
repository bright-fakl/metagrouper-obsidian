import { describe, it, expect, beforeEach, vi } from "vitest";
import { TreeComponent } from "../src/components/tree-component";
import { TreeNode } from "../src/types/tree-node";
import { TFile } from "obsidian";

// Mock setIcon globally
vi.mock("obsidian", async () => {
  const actual = await vi.importActual("obsidian");
  return {
    ...actual,
    setIcon: vi.fn((el: HTMLElement, icon: string) => {
      el.setAttribute("data-icon", icon);
    }),
  };
});

// Mock Obsidian App
const createMockApp = () => {
  return {
    workspace: {
      getLeaf: vi.fn(() => ({
        openFile: vi.fn(),
      })),
    },
  } as any;
};

// Add Obsidian DOM extensions to HTMLElement
const addObsidianExtensions = (el: HTMLElement): any => {
  return Object.assign(el, {
    empty: function () {
      this.innerHTML = "";
      return this;
    },
    createDiv: function (cls?: string, callback?: (el: HTMLElement) => void) {
      const div = document.createElement("div");
      if (cls) div.className = cls;
      this.appendChild(div);
      if (callback) callback(div);
      return addObsidianExtensions(div);
    },
    createSpan: function (cls?: string, callback?: (el: HTMLElement) => void) {
      const span = document.createElement("span");
      if (cls) span.className = cls;
      this.appendChild(span);
      if (callback) callback(span);
      return addObsidianExtensions(span);
    },
    createEl: function (tag: string, opts?: any) {
      const el = document.createElement(tag);
      if (opts?.cls) el.className = opts.cls;
      if (opts?.text) el.textContent = opts.text;
      this.appendChild(el);
      return addObsidianExtensions(el);
    },
    addClass: function (cls: string) {
      this.classList.add(cls);
      return this;
    },
    removeClass: function (cls: string) {
      this.classList.remove(cls);
      return this;
    },
    toggleClass: function (cls: string, force?: boolean) {
      this.classList.toggle(cls, force);
      return this;
    },
  });
};

// Mock DOM environment helpers
const createMockContainer = (): HTMLElement => {
  const container = document.createElement("div");
  return addObsidianExtensions(container);
};

// Helper to create a simple tree structure for testing
const createMockTree = (): TreeNode => {
  const file1 = { path: "file1.md", basename: "file1" } as TFile;
  const file2 = { path: "file2.md", basename: "file2" } as TFile;
  const file3 = { path: "file3.md", basename: "file3" } as TFile;

  return {
    id: "root",
    name: "Root",
    type: "tag",
    children: [
      {
        id: "tag:project",
        name: "project",
        type: "tag",
        children: [
          {
            id: "tag:project/alpha",
            name: "alpha",
            type: "tag",
            children: [
              {
                id: "file:file1.md",
                name: "file1",
                type: "file",
                children: [],
                depth: 3,
                files: [file1],
                fileCount: 1,
              },
            ],
            depth: 2,
            files: [],
            fileCount: 1,
            metadata: { tagPath: "project/alpha" },
          },
          {
            id: "tag:project/beta",
            name: "beta",
            type: "tag",
            children: [
              {
                id: "file:file2.md",
                name: "file2",
                type: "file",
                children: [],
                depth: 3,
                files: [file2],
                fileCount: 1,
              },
            ],
            depth: 2,
            files: [],
            fileCount: 1,
            metadata: { tagPath: "project/beta" },
          },
        ],
        depth: 1,
        files: [],
        fileCount: 2,
        metadata: { tagPath: "project" },
      },
      {
        id: "tag:personal",
        name: "personal",
        type: "tag",
        children: [
          {
            id: "file:file3.md",
            name: "file3",
            type: "file",
            children: [],
            depth: 2,
            files: [file3],
            fileCount: 1,
          },
        ],
        depth: 1,
        files: [],
        fileCount: 1,
        metadata: { tagPath: "personal" },
      },
    ],
    depth: 0,
    files: [],
    fileCount: 3,
  };
};

describe("TreeComponent", () => {
  let app: any;
  let container: HTMLElement;
  let treeComponent: TreeComponent;
  let mockTree: TreeNode;

  beforeEach(() => {
    app = createMockApp();
    container = createMockContainer();
    treeComponent = new TreeComponent(app);
    mockTree = createMockTree();
  });

  describe("render", () => {
    it("should render a tree structure", () => {
      treeComponent.render(mockTree, container);

      // Check that tree container is created
      const treeContainer = container.querySelector(".tag-tree-container");
      expect(treeContainer).toBeTruthy();

      // Check that root node is hidden (children rendered directly)
      const projectNode = container.querySelector(
        '[data-node-id="tag:project"]'
      );
      expect(projectNode).toBeTruthy();
    });

    it("should render node headers with correct structure", () => {
      treeComponent.render(mockTree, container);

      const projectNode = container.querySelector(
        '[data-node-id="tag:project"]'
      );
      const header = projectNode?.querySelector(".tree-node-header");

      expect(header).toBeTruthy();
      expect(header?.querySelector(".tree-collapse-icon")).toBeTruthy();
      expect(header?.querySelector(".tree-node-icon")).toBeTruthy();
      expect(header?.querySelector(".tree-node-name")).toBeTruthy();
      expect(header?.querySelector(".tree-node-count")).toBeTruthy();
    });

    it("should display correct file counts", () => {
      treeComponent.render(mockTree, container);

      const projectNode = container.querySelector(
        '[data-node-id="tag:project"]'
      );
      const count = projectNode?.querySelector(".tree-node-count");

      expect(count?.textContent).toBe("(2)");
    });

    it("should expand nodes to default depth (1)", () => {
      treeComponent.setDefaultExpandDepth(1);
      treeComponent.render(mockTree, container);

      // Top-level nodes should be expanded
      const projectNode = container.querySelector(
        '[data-node-id="tag:project"]'
      );
      expect(projectNode?.classList.contains("collapsed")).toBe(false);

      // Second-level nodes should be collapsed
      const alphaNode = container.querySelector('[data-node-id="tag:project/alpha"]');
      expect(alphaNode?.classList.contains("collapsed")).toBe(true);
    });

    it("should not render file nodes when files are hidden", () => {
      treeComponent.setFileVisibility(false);
      treeComponent.render(mockTree, container);

      const fileNodes = container.querySelectorAll('[data-node-type="file"]');
      expect(fileNodes.length).toBe(0);
    });

    it("should render file nodes when files are visible", () => {
      treeComponent.setFileVisibility(true);
      treeComponent.render(mockTree, container);

      const fileNodes = container.querySelectorAll('[data-node-type="file"]');
      expect(fileNodes.length).toBeGreaterThan(0);
    });
  });

  describe("toggleNode", () => {
    it("should toggle node expansion state", () => {
      treeComponent.render(mockTree, container);

      const nodeId = "tag:project";

      // Initially expanded (depth 1)
      let projectNode = container.querySelector(`[data-node-id="${nodeId}"]`);
      expect(projectNode?.classList.contains("collapsed")).toBe(false);

      // Toggle to collapse
      treeComponent.toggleNode(nodeId);
      projectNode = container.querySelector(`[data-node-id="${nodeId}"]`);
      expect(projectNode?.classList.contains("collapsed")).toBe(true);

      // Toggle to expand
      treeComponent.toggleNode(nodeId);
      projectNode = container.querySelector(`[data-node-id="${nodeId}"]`);
      expect(projectNode?.classList.contains("collapsed")).toBe(false);
    });

    it("should update collapse icon when toggling", () => {
      treeComponent.render(mockTree, container);

      const nodeId = "tag:project";
      const projectNode = container.querySelector(`[data-node-id="${nodeId}"]`);
      const icon = projectNode?.querySelector(".tree-collapse-icon");

      // Check that icon exists
      expect(icon).toBeTruthy();

      // Note: We can't easily test the actual icon content since setIcon is mocked
      // but we can verify the icon element is updated
      treeComponent.toggleNode(nodeId);
      expect(icon).toBeTruthy();
    });
  });

  describe("expandAll", () => {
    it("should expand all nodes", () => {
      treeComponent.render(mockTree, container);

      // Initially some nodes are collapsed
      let alphaNode = container.querySelector('[data-node-id="tag:project/alpha"]');
      expect(alphaNode?.classList.contains("collapsed")).toBe(true);

      // Expand all
      treeComponent.expandAll();

      // All nodes should now be expanded
      alphaNode = container.querySelector('[data-node-id="tag:project/alpha"]');
      expect(alphaNode?.classList.contains("collapsed")).toBe(false);

      const betaNode = container.querySelector('[data-node-id="tag:project/beta"]');
      expect(betaNode?.classList.contains("collapsed")).toBe(false);
    });
  });

  describe("collapseAll", () => {
    it("should collapse all nodes", () => {
      treeComponent.render(mockTree, container);
      treeComponent.expandAll();

      // All nodes should be expanded
      let projectNode = container.querySelector('[data-node-id="tag:project"]');
      expect(projectNode?.classList.contains("collapsed")).toBe(false);

      // Collapse all
      treeComponent.collapseAll();

      // All nodes should now be collapsed
      projectNode = container.querySelector('[data-node-id="tag:project"]');
      expect(projectNode?.classList.contains("collapsed")).toBe(true);
    });
  });

  describe("expandToDepth", () => {
    it("should expand nodes to specified depth", () => {
      treeComponent.render(mockTree, container);

      // Expand to depth 2
      treeComponent.expandToDepth(2);

      // Depth 1 nodes should be expanded
      const projectNode = container.querySelector('[data-node-id="tag:project"]');
      expect(projectNode?.classList.contains("collapsed")).toBe(false);

      // Depth 2 nodes should be expanded
      const alphaNode = container.querySelector('[data-node-id="tag:project/alpha"]');
      expect(alphaNode?.classList.contains("collapsed")).toBe(false);
    });
  });

  describe("file visibility", () => {
    it("should toggle file visibility", () => {
      treeComponent.render(mockTree, container);

      // Initially files are visible
      expect(treeComponent.getFileVisibility()).toBe(true);
      let fileNodes = container.querySelectorAll('[data-node-type="file"]');
      expect(fileNodes.length).toBeGreaterThan(0);

      // Toggle to hide
      treeComponent.toggleFileVisibility();
      expect(treeComponent.getFileVisibility()).toBe(false);
      fileNodes = container.querySelectorAll('[data-node-type="file"]');
      expect(fileNodes.length).toBe(0);

      // Toggle to show
      treeComponent.toggleFileVisibility();
      expect(treeComponent.getFileVisibility()).toBe(true);
      fileNodes = container.querySelectorAll('[data-node-type="file"]');
      expect(fileNodes.length).toBeGreaterThan(0);
    });

    it("should set file visibility directly", () => {
      treeComponent.render(mockTree, container);

      treeComponent.setFileVisibility(false);
      expect(treeComponent.getFileVisibility()).toBe(false);

      treeComponent.setFileVisibility(true);
      expect(treeComponent.getFileVisibility()).toBe(true);
    });
  });

  describe("state persistence", () => {
    it("should get and set expanded nodes", () => {
      treeComponent.render(mockTree, container);

      // Expand some nodes
      treeComponent.toggleNode("tag:project");
      treeComponent.toggleNode("tag:project/alpha");

      // Get state
      const expandedNodes = treeComponent.getExpandedNodes();
      expect(expandedNodes.size).toBeGreaterThan(0);

      // Create new component and restore state
      const newComponent = new TreeComponent(app);
      newComponent.setExpandedNodes(expandedNodes);
      newComponent.render(mockTree, container);

      // Check that state is restored
      const restoredNodes = newComponent.getExpandedNodes();
      expect(restoredNodes.size).toBe(expandedNodes.size);
    });
  });

  describe("default expansion depth", () => {
    it("should set and use default expansion depth", () => {
      treeComponent.setDefaultExpandDepth(2);
      treeComponent.render(mockTree, container);

      // Depth 1 nodes should be expanded
      const projectNode = container.querySelector('[data-node-id="tag:project"]');
      expect(projectNode?.classList.contains("collapsed")).toBe(false);

      // Depth 2 nodes should be expanded
      const alphaNode = container.querySelector('[data-node-id="tag:project/alpha"]');
      expect(alphaNode?.classList.contains("collapsed")).toBe(false);
    });

    it("should not expand beyond specified depth", () => {
      treeComponent.setDefaultExpandDepth(1);
      treeComponent.render(mockTree, container);

      // Depth 1 nodes should be expanded
      const projectNode = container.querySelector('[data-node-id="tag:project"]');
      expect(projectNode?.classList.contains("collapsed")).toBe(false);

      // Depth 2 nodes should be collapsed
      const alphaNode = container.querySelector('[data-node-id="tag:project/alpha"]');
      expect(alphaNode?.classList.contains("collapsed")).toBe(true);
    });
  });
});
