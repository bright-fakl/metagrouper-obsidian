# Tag Tree View - User Guide

Welcome to the comprehensive user guide for the Tag Tree View plugin! This guide will walk you through all features and provide detailed instructions for getting the most out of the plugin.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Tree View](#understanding-the-tree-view)
3. [Navigation and Interaction](#navigation-and-interaction)
4. [Creating Custom Views](#creating-custom-views)
5. [Using the Toolbar](#using-the-toolbar)
6. [Embedding Trees in Notes](#embedding-trees-in-notes)
7. [Advanced Configuration](#advanced-configuration)
8. [Tips and Best Practices](#tips-and-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Opening the Tag Tree View

There are several ways to open the Tag Tree View:

1. **Sidebar Icon**: Click the tree icon (🌳) in the left sidebar
2. **Command Palette**: Press `Ctrl/Cmd + P` and search for "Tag Tree: Open tag tree view"
3. **Ribbon**: Click the Tag Tree icon in the ribbon (if enabled)

### First Look

When you first open the Tag Tree View, you'll see:

- **Toolbar**: At the top with view selection, sorting, and expansion controls
- **Tree Container**: The main area displaying your tag hierarchy
- **File Counts**: Numbers in parentheses showing how many files are in each node

### Basic Interaction

- **Expand/Collapse**: Click on a node or its chevron icon to toggle
- **Open Files**: Click on a file name to open it in the editor
- **Navigate**: Use arrow keys to move through the tree (see [Keyboard Navigation](#keyboard-navigation))

---

## Understanding the Tree View

### Node Types

The tree view displays three types of nodes:

#### 1. Tag Nodes
- **Icon**: Tags icon (🏷️)
- **Represents**: A tag or tag segment in your hierarchy
- **Example**: `#project`, `#project/alpha`, `#project/alpha/feature`

#### 2. Property Group Nodes
- **Icon**: List icon (📋)
- **Represents**: A grouping by frontmatter property value
- **Example**: When grouping by `status: active`

#### 3. File Nodes
- **Icon**: File icon (📄)
- **Represents**: An individual note
- **Behavior**: Clicking opens the file

### Tag Hierarchy

Tags with slashes (`/`) create hierarchies automatically:

```
#project                 → Root tag
#project/alpha          → Child of #project
#project/alpha/feature  → Child of #project/alpha
#project/beta           → Child of #project
```

**Visual Result:**
```
📁 project (3)
  📁 alpha (2)
    📁 feature (1)
      📄 Feature Implementation.md
    📄 Alpha Overview.md
  📁 beta (1)
    📄 Beta Planning.md
```

### File Counts

Numbers in parentheses show the **total** files in that node and all its children:

- `project (3)` means 3 files total under #project
- `alpha (2)` means 2 files under #project/alpha
- `feature (1)` means 1 file under #project/alpha/feature

---

## Navigation and Interaction

### Mouse Navigation

#### Basic Clicking
- **Click node name**: Toggle expand/collapse (or open file for file nodes)
- **Click chevron icon**: Toggle expand/collapse
- **Hover**: View tooltip with full path and file count

#### File Opening
- **Left click file**: Opens in the current editor pane
- Files are displayed with a file icon (📄)

### Keyboard Navigation

The tree view supports full keyboard navigation for efficiency:

#### Basic Movement
- **↓ (Down Arrow)**: Move to the next visible node
- **↑ (Up Arrow)**: Move to the previous visible node
- **Home**: Jump to the first node
- **End**: Jump to the last node

#### Expand/Collapse
- **→ (Right Arrow)**:
  - Expand the current node if collapsed
  - Move to first child if already expanded
- **← (Left Arrow)**:
  - Collapse the current node if expanded
  - Move to parent node if already collapsed

#### Actions
- **Enter**:
  - Open file (if file node)
  - Toggle expand/collapse (if folder/tag node)
- **Space**: Toggle expand/collapse

#### Focus Management
- **Tab**: Move focus into the tree (from toolbar)
- **Shift + Tab**: Move focus out of the tree
- Focused nodes are highlighted with an outline

### Accessibility

The tree view includes basic accessibility features:

- **ARIA roles**: Proper semantic structure
- **Keyboard accessible**: Full functionality without mouse
- **Focus indicators**: Clear visual feedback
- **Tooltips**: Additional context on hover

---

## Creating Custom Views

Custom views allow you to organize notes in different ways beyond simple tag hierarchies.

### Accessing View Configuration

1. Open Obsidian Settings (`Ctrl/Cmd + ,`)
2. Navigate to "Tag Tree View" in the plugin settings
3. You'll see a list of saved views and controls to add/edit/delete

### View Configuration Basics

Each view has:
- **Name**: Display name in the view selector
- **Root Tag** (optional): Filter to only notes with this tag
- **Hierarchy Levels**: Define how notes are grouped
- **Default Expansion**: How many levels to expand initially

### Adding Hierarchy Levels

Levels are processed top-to-bottom. Each level groups files by either a tag or property.

#### Tag Level
Groups files by tags matching a pattern:

```yaml
type: tag
key: "project"        # Groups by #project/* tags
label: "Projects"     # Optional display name
```

#### Property Level
Groups files by frontmatter property values:

```yaml
type: property
key: "status"         # Groups by 'status' property
label: "Status"       # Optional display name
```

### Example Configuration Flow

Let's create a view that organizes project notes:

**Goal**: Group by project name → status → priority

**Notes Example:**
```yaml
---
project: Website Redesign
status: active
priority: high
tags: [project/frontend]
---
```

**View Configuration:**
1. **Name**: "Projects Dashboard"
2. **Root Tag**: `#project` (optional filter)
3. **Levels**:
   - Level 1: Property `project`
   - Level 2: Property `status`
   - Level 3: Property `priority`

**Result:**
```
📋 Website Redesign (5)
  📋 active (3)
    📋 high (2)
      📄 Homepage Mockup.md
      📄 Color Scheme.md
    📋 medium (1)
      📄 Footer Design.md
  📋 planning (2)
    📋 low (2)
      📄 Research.md
      📄 Competitors.md
```

### Mixing Tags and Properties

You can combine tag and property levels for sophisticated organizations:

**Example: Content Creation Workflow**

```yaml
name: "Content Pipeline"
root: "#article"
levels:
  - type: tag
    key: "article"
  - type: property
    key: "category"
  - type: property
    key: "status"
```

This creates a hierarchy: Article Type → Category → Status

### Managing Multiple Views

You can create multiple views for different purposes:

- **All Tags**: Simple tag hierarchy (default)
- **Projects**: Project management view
- **Research**: Academic organization
- **Daily Notes**: Date-based organization
- **Content**: Writing workflow

Switch between them using the view selector in the toolbar.

---

## Using the Toolbar

The toolbar provides quick access to tree controls:

### View Selector

**Location**: Top left of toolbar

**Function**: Switch between saved views

**Usage**:
1. Click the dropdown
2. Select a view name
3. Tree rebuilds with the new configuration

**Tip**: Create views for different work contexts and switch as needed

### Sort Mode

**Location**: Toolbar, Sort dropdown

**Options**:
- **A→Z**: Alphabetical ascending
- **Z→A**: Alphabetical descending
- **9→1**: By file count (most first)
- **1→9**: By file count (least first)

**Usage**: Click dropdown and select desired sort mode

**Note**: Sorting applies to all levels of the tree

### Expand to Depth

**Location**: Toolbar, depth buttons (1, 2, 3, All)

**Function**: Quickly expand tree to a specific depth

**Depths**:
- **1**: Only first level visible
- **2**: First and second levels
- **3**: First three levels
- **All**: Everything expanded

**Usage**: Click a depth button

**Tip**: Use "1" to get an overview, then manually expand areas of interest

### Collapse/Expand All

**Location**: Toolbar buttons

**Functions**:
- **Collapse All**: Closes all nodes
- **Expand All**: Opens all nodes

**Usage**: Click the respective button

**Warning**: "Expand All" on large vaults may take a moment and create a very long list

### Show Files Toggle

**Location**: Toolbar toggle button

**Function**: Show or hide individual file nodes in the tree

**States**:
- **Enabled** (default): Files shown under their parent nodes
- **Disabled**: Only tag/property group nodes visible

**Usage**: Click the toggle button

**Use Case**: Hide files to see just the organizational structure

---

## Embedding Trees in Notes

You can embed tree views directly in your notes using codeblocks.

### Basic Syntax

````markdown
```tagtree
view: "View Name"
```
````

This references a saved view and displays it inline.

### Inline Configuration

Define a tree structure without creating a saved view:

````markdown
```tagtree
root: #project
levels:
  - tag: "project"
  - property: "status"
sort: alpha-asc
expanded: 2
```
````

### Configuration Options

#### Reference Saved View
```yaml
view: "My Custom View"
```

#### Define Hierarchy Inline
```yaml
root: #research              # Optional root tag filter
levels:                      # Hierarchy definition
  - tag: "research"
  - property: "field"
  - property: "year"
```

#### Display Options
```yaml
sort: alpha-asc             # alpha-asc, alpha-desc, count-asc, count-desc
expanded: 2                 # Default expansion depth (number or "all")
format: tree                # "tree" (default) or "list"
interactive: true           # Enable clicking (default: true)
```

### Output Formats

#### Tree Format (Default)
Interactive tree with expand/collapse functionality:

```
🌳 project
  └─ alpha
     └─ Feature.md
```

#### List Format
Simple nested list:

```
• project (2)
  • alpha (1)
    • Feature.md
  • beta (1)
    • Planning.md
```

### Examples

#### Project Status Board

````markdown
# Project Status

```tagtree
view: "Projects Dashboard"
expanded: 2
```
````

#### Research Papers by Year

````markdown
# My Publications

```tagtree
root: #research/papers
levels:
  - property: "year"
  - property: "status"
sort: count-desc
expanded: all
```
````

#### Simple Tag Index

````markdown
# Note Index

```tagtree
root: #moc
levels:
  - tag: "moc"
format: list
```
````

### Non-Interactive Mode

For read-only displays:

````markdown
```tagtree
view: "All Tags"
interactive: false
```
````

This disables clicking and hover effects, useful for exported/printed notes.

---

## Advanced Configuration

### Root Tag Filtering

Limit a view to only notes with a specific tag:

```yaml
name: "Project View"
rootTag: "#project"
```

**Effect**: Only files tagged with `#project` (or child tags) appear in this view

**Use Case**: Create focused views for different areas of your vault

### Default Expansion Depth

Control how many levels open automatically:

```yaml
defaultExpanded: 2
```

- `0`: All collapsed
- `1`: First level only
- `2`: First two levels
- `-1`: All expanded

**Tip**: Use 1-2 for large vaults to avoid overwhelming initial display

### Custom Labels

Override the display name for hierarchy levels:

```yaml
levels:
  - type: property
    key: "status"
    label: "Current Status"
```

The tree will show "Current Status" instead of "status"

### Sorting by Level

*Note: Currently, sorting applies globally. Per-level sorting is planned for future releases.*

---

## Tips and Best Practices

### Organizing Your Vault

#### Use Consistent Nested Tags

**Good**:
```
#project/alpha
#project/beta
#project/alpha/feature-a
```

**Avoid**:
```
#project-alpha
#beta-project
#feature_a
```

Consistent nesting creates cleaner hierarchies.

#### Combine Tags and Properties

Use tags for broad categories and properties for specific attributes:

```yaml
---
tags: [project/website]
status: active
priority: high
assignee: Alice
---
```

This allows flexible view configurations.

#### Create Context-Specific Views

Don't try to make one view do everything. Create multiple:

- **All Tags**: Browse everything
- **Active Projects**: Filter by `status: active`
- **My Tasks**: Filter by `assignee: Your Name`
- **Archive**: View completed work

### Performance Tips

#### For Large Vaults (1000+ notes)

1. **Use Root Tag Filters**: Narrow views to relevant subsets
2. **Keep Default Expansion Low**: Start with depth 1-2
3. **Hide Files Initially**: Use Show Files toggle when needed
4. **Create Multiple Specific Views**: Instead of one huge view

#### Tag Indexing

The plugin automatically re-indexes when files change, but:

- **Debounced Updates**: Rapid changes are batched (300ms delay)
- **Incremental**: Only changed files are re-indexed
- **Efficient**: Uses optimized data structures

### Workflow Integration

#### Morning Review

Create a "Today's Focus" view:

```yaml
name: "Today"
root: "#daily"
levels:
  - property: "date"
  - property: "priority"
```

#### Project Management

Weekly status view:

```yaml
name: "Weekly Status"
root: "#project"
levels:
  - property: "project"
  - property: "status"
  - property: "assignee"
```

#### Research Organization

Paper tracking:

```yaml
name: "Research Papers"
root: "#research/paper"
levels:
  - property: "field"
  - property: "year"
  - property: "read-status"
```

---

## Troubleshooting

### Common Issues

#### Tree Not Updating After Changes

**Symptom**: You edited a note's tags but the tree hasn't updated

**Solutions**:
1. Wait 300ms - updates are debounced
2. Check that the tag syntax is correct (`#tag` not `tag`)
3. Try manually refreshing: close and reopen the view

#### View Configuration Not Saving

**Symptom**: Changes in settings don't persist

**Solutions**:
1. Make sure you clicked "Save"
2. Check Obsidian's console for errors (Ctrl/Cmd + Shift + I)
3. Verify your configuration syntax is valid

#### Files Not Appearing in View

**Symptom**: A file doesn't show up where expected

**Possible Causes**:
1. **Root Tag Filter**: The file doesn't have the root tag
2. **Show Files Disabled**: Toggle "Show Files" in toolbar
3. **Property Not Set**: Missing required frontmatter property
4. **Tag Typo**: Check tag spelling and case

**Debug Steps**:
1. Check the file's frontmatter and tags
2. Try viewing in "All Tags" default view
3. Verify property names match exactly (case-sensitive)

#### Keyboard Navigation Not Working

**Symptom**: Arrow keys don't navigate the tree

**Solutions**:
1. Click on a node first to focus the tree
2. Check that focus is in the tree (not toolbar or search)
3. Try pressing Tab to move focus into the tree

#### Performance Issues

**Symptom**: Tree is slow to load or navigate

**Solutions**:
1. Reduce default expansion depth in view settings
2. Use root tag filters to limit scope
3. Create smaller, focused views instead of one large view
4. Consider hiding files initially

### Getting Help

If you encounter issues not covered here:

1. **Check Documentation**: See [Examples](examples.md) for more use cases
2. **GitHub Issues**: Search existing issues or create a new one
3. **Obsidian Forum**: Ask in the community
4. **Enable Debug Mode**: Check browser console for error messages

### Reporting Bugs

When reporting a bug, please include:

1. **Obsidian Version**: Found in Settings → About
2. **Plugin Version**: 0.0.1 (found in Community Plugins)
3. **Steps to Reproduce**: Detailed description
4. **Expected Behavior**: What should happen
5. **Actual Behavior**: What actually happens
6. **Console Errors**: Press Ctrl/Cmd + Shift + I, check Console tab
7. **View Configuration**: If relevant, share your view config

---

## Keyboard Reference Card

Quick reference for all keyboard shortcuts:

| Key | Action |
|-----|--------|
| ↓ | Next node |
| ↑ | Previous node |
| → | Expand node / Move to first child |
| ← | Collapse node / Move to parent |
| Enter | Open file / Toggle node |
| Space | Toggle expand/collapse |
| Home | First node |
| End | Last node |
| Tab | Focus tree (from toolbar) |
| Shift+Tab | Focus toolbar (from tree) |

---

## Next Steps

Now that you're familiar with the Tag Tree View plugin:

1. **Create Your First Custom View**: Organize your notes by project or topic
2. **Experiment with Hierarchies**: Try different combinations of tags and properties
3. **Explore Examples**: See [examples.md](examples.md) for inspiration
4. **Optimize Your Workflow**: Create views for different contexts
5. **Share Your Setups**: Contribute example configurations to help others

Enjoy organizing your knowledge! 🌳✨
