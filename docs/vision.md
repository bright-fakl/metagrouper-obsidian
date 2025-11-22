# Obsidian MetaGrouper Plugin — Project Vision & Implementation Plan

## 1. Project Vision

The goal of this project is to build a powerful, flexible Obsidian plugin that provides an **interactive hierarchical view** of a user's notes based on **nested tags**, **frontmatter fields**, or **custom-defined grouping rules**. Unlike Dataview, DataCore, or Obsidian Bases, which primarily output flat lists or tables, this plugin focuses on enabling **intuitive, visual navigation** of large vaults through collapsible tree structures.

This plugin should:

* **Require no runtime dependencies** (no Dataview/DataCore/Bases required)
* Leverage only Obsidian's built-in metadata index
* Provide both **sidebar integration** and **in-document codeblock views**
* Scale efficiently to large vaults (5k–50k notes)
* Support multiple **saved hierarchical “views”** selectable via UI
* Offer a clean, extensible architecture for future features

The result will be a standalone navigation and metadata-organization tool that complements existing plugins while introducing functionality they cannot provide.

---

## 2. Core Capabilities

The plugin will support the following key features:

### **2.1 Tree View Based on Nested Tags**

* Interpret tags like `#a/b/c` as hierarchical levels
* Display them as collapsible nodes in a sidebar
* Group files under the appropriate leaf nodes

### **2.2 Custom Hierarchy Rules**

Users may define per-view hierarchy steps:

* Group by **nested tag prefix**
* Group by **frontmatter property**
* Group by **inline fields**
* Group by literal values

Example hierarchy:

1. `project` (frontmatter)
2. nested `#topic/*` tag
3. `status` (frontmatter)

### **2.3 Multiple Saved Views**

Users can create and save multiple tree configurations, each with:

* Name
* Root tag (optional)
* Hierarchy definition
* Sorting rules
* Default collapsed/expanded levels

### **2.4 Rendering in Sidebar and Codeblocks**

* **Sidebar:** an interactive tree with collapse/expand icons
* **Codeblock:** static or semi-interactive nested lists generated with:

  ````
  ```metagrouper
  root: #research
  levels:
    - tag: "#research"
    - property: "topic"
  ```
  ````

### **2.5 Performance Optimized for Large Vaults**

* Incremental indexing of tags + frontmatter
* Query-time filtering by root tag
* Optional virtualized DOM rendering for very large trees

---

## 3. Plugin Architecture

The design centers around **separation of concerns**, allowing the UI, indexing, and tree-building to evolve independently.

### **3.1 VaultIndexer**

A self-contained module with:

* Extracted tags per file
* Extracted frontmatter + inline properties
* Reverse mappings:

  * tag → files
  * property → value → files
* Incremental updates on metadata changes

### **3.2 TreeBuilder**

Consumes:

* Index data
* User-selected hierarchy definition
* Root-tag filter
* Sorting preferences

Produces a tree structure:

```ts
interface TreeNode {
  id: string;
  name: string;
  children: TreeNode[];
  files: TFile[];
}
```

### **3.3 MetaGrouperView (Sidebar)**

Responsible for:

* Rendering the collapsible UI
* Maintaining expand/collapse state
* Displaying toolbar controls:

  * Collapse/expand all
  * Expand to depth N
  * Switch saved views

### **3.4 Markdown Codeblock Processor**

Generates a nested list inside notes based on:

````
```metagrouper
view: "Project Overview"
```
````

Or inline parameters.

### **3.5 Settings Tab**
UI for:
- Managing saved views
- Creating/editing hierarchies
- Choosing default root tag
- Sorting preferences

---

## 4. Implementation Plan
This plan outlines recommended development stages.

### **Phase 1 — Foundations**
1. Set up plugin scaffolding (Obsidian’s sample plugin template)
2. Implement basic VaultIndexer
3. Implement simple TreeBuilder with nested-tag support only
4. Implement sidebar view with basic rendering

### **Phase 2 — Collapsible Tree & Sorting**
1. Add collapsible/expandable nodes
2. Add sorting controls (alphabetical, size)
3. Add toolbar controls for basic interaction

### **Phase 3 — Custom Hierarchy Engine**
1. Define hierarchy schema format
2. Support grouping by properties
3. Add hierarchy editor UI in Settings
4. Update TreeBuilder to support multi-level grouping

### **Phase 4 — Saved Views System**
1. Persist view configurations in plugin settings
2. Sidebar UI for switching views
3. Add commands for quick switching

### **Phase 5 — Markdown Codeblock Rendering**
1. Register the `metagrouper` codeblock processor
2. Support parameters or view references
3. Render nested lists with `<ul>`/`<li>` or `<details>` blocks

### **Phase 6 — Optimization & Advanced Features**
1. Incremental updates for large vaults
2. Flatten tree for faster rendering
3. Optional virtual DOM rendering
4. Keyboard and accessibility enhancements

### **Phase 7 — Polish & Release**
1. Add CSS for polished visuals
2. Provide sample views
3. Package for community release

---

## 5. Guiding Design Principles
- **Zero external dependencies** (Dataview, DataCore not required)
- **High performance** with incremental indexing
- **Separation of concerns** for maintainability
- **User configurability** instead of hard-coded logic
- **Interoperability** (optional integration with Dataview/DataCore in the future)
- **Minimal UI friction**: tree should feel native to Obsidian

---

## 6. Expected Future Extensions
- Query language for advanced filtering
- Plugin API for other plugins to register custom hierarchy rules
- Theming extensions and per-view styling
- Ability to fold tree nodes in rendered Markdown codeblocks
- Integration with graph view or backlink explorer

---

## 7. Project Summary
This plugin fills a significant gap in the current Obsidian ecosystem by offering a **true hierarchical navigation layer** that can be:
- Tag-driven
- Property-driven
- Fully customized
- Saved and reused
- Rendered both inside the workspace and inside documents

With a dependency-free architecture and a scalable indexer, it becomes a long-term, maintainable solution for organizing and navigating large Obsidian vaults.

---

**End of Document**

```
