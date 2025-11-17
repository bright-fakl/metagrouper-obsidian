# Tag Tree View Plugin for Obsidian

A powerful Obsidian plugin that organizes your notes into hierarchical tree views based on nested tags and frontmatter properties.

![Tag Tree View](https://img.shields.io/badge/version-0.0.1-blue)
![Obsidian](https://img.shields.io/badge/obsidian-%3E%3D1.5.0-purple)

## 🌟 Features

### 🏷️ Nested Tag Hierarchies
- Automatically builds tree structures from nested tags (e.g., `#project/alpha/feature`)
- Visual organization that mirrors your tag structure
- File counts at each level showing total notes in subtrees

### 🎨 Custom View Configurations
- Create multiple saved views with different organizational schemes
- Mix tags and frontmatter properties in multi-level hierarchies
- Example: Group by `project` → `status` → `priority`

### 🎯 Interactive Tree UI
- Collapsible/expandable nodes with smooth animations
- Click to navigate to notes
- File visibility toggle to show/hide individual files
- Multiple sorting options (alphabetical, by file count)
- Expand to specific depths (1, 2, 3, or all levels)

### ⌨️ Keyboard Navigation
- **Arrow Keys**: Navigate up/down through tree, expand/collapse with left/right
- **Enter**: Open files or toggle folders
- **Space**: Toggle expand/collapse
- **Home/End**: Jump to first/last item

### 📝 Markdown Codeblock Support
Embed tree views directly in your notes:

````markdown
```tagtree
view: "My Custom View"
```
````

Or define inline configurations:

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

### 💾 Persistent State
- Remembers which nodes are expanded/collapsed
- Preserves scroll position
- Maintains settings per view

### ⚡ Performance Optimized
- Incremental index updates (only re-indexes changed files)
- Debounced batch updates for multiple rapid changes
- Smart partial DOM updates (only re-renders affected nodes)
- Efficient data structures for fast lookups

## 📦 Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Tag Tree View"
4. Click Install, then Enable

### Manual Installation
1. Download the latest release from the [Releases](../../releases) page
2. Extract the files to your vault's `.obsidian/plugins/tag-tree-view/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### For Development
```bash
# Clone the repository
git clone https://github.com/fkloosterman/tag-tree-obsidian.git
cd tag-tree-obsidian

# Install dependencies
npm install

# Build the plugin
npm run build

# For development with auto-reload
npm run dev
```

## 🚀 Quick Start

### 1. Open the Tag Tree View
- Click the tree icon in the left sidebar
- Or use the command palette: `Tag Tree: Open tag tree view`

### 2. Basic Usage
The plugin automatically indexes all tags in your vault and displays them in a tree structure. Click on any tag to expand/collapse it, or click on a file name to open it.

### 3. Create a Custom View
1. Open Settings → Tag Tree View
2. Click "Add New View"
3. Configure your hierarchy:
   - Add levels (tags or properties)
   - Set sorting preferences
   - Define a root tag filter (optional)
4. Save and switch to your new view

## 📖 Documentation

- **[User Guide](docs/user-guide.md)** - Comprehensive guide to all features
- **[Examples](docs/examples.md)** - Sample configurations and use cases
- **[Implementation Plan](docs/implementation-plan.md)** - Technical roadmap
- **[Technical Architecture](docs/technical-architecture.md)** - Implementation details
- **[Codeblock Usage](docs/codeblock-usage.md)** - Embedding trees in notes

## 🎯 Use Cases

### Project Management
```yaml
# View: Projects by Status
levels:
  - property: project
  - property: status
  - tag: "task"
```

Organizes your project notes by project name, then status (active, planning, completed), then task tags.

### Research Organization
```yaml
# View: Research by Topic
root: #research
levels:
  - tag: "research"
  - property: "field"
  - property: "year"
```

Groups research notes by research topic, academic field, and publication year.

### Content Creation
```yaml
# View: Articles by Category
root: #article
levels:
  - tag: "article"
  - property: "category"
  - property: "status"
```

Organizes articles by category and publication status.

## ⚙️ Configuration

### Plugin Settings

Access settings via Settings → Tag Tree View:

- **Saved Views**: Create and manage custom view configurations
- **Default View**: Set which view opens on startup
- **View States**: Automatically saved per-view (expand/collapse state, scroll position)

### View Configuration Schema

```typescript
{
  name: string;              // Display name
  rootTag?: string;          // Optional filter (e.g., "#project")
  levels: Array<{
    type: 'tag' | 'property';
    key: string;             // Tag prefix or property name
    label?: string;          // Display name override
    sortBy?: SortMode;       // Sort preference
  }>;
  defaultExpanded?: number;  // Default expansion depth
}
```

### Codeblock Options

```yaml
view: "View Name"          # Reference a saved view
root: #tag                 # Filter by root tag
levels:                    # Define hierarchy inline
  - tag: "tagname"
  - property: "propname"
sort: alpha-asc           # alpha-asc, alpha-desc, count-asc, count-desc
expanded: 2               # Default expansion depth
format: tree              # tree or list (default: tree)
interactive: true         # Enable clicking (default: true)
```

## 🔧 Toolbar Controls

The tree view toolbar provides quick access to common operations:

- **View Selector**: Switch between saved views
- **Sort Mode**: Change sorting (alphabetical or by file count)
- **Expand To**: Quickly expand to depth 1, 2, 3, or all
- **Show Files Toggle**: Show/hide individual file nodes
- **Collapse All / Expand All**: Quick navigation controls

## 🎨 Styling

The plugin uses Obsidian's native CSS variables and adapts to both light and dark themes. You can customize appearance using CSS snippets:

```css
/* Increase indent for nested levels */
.tree-node-children {
  padding-left: 24px;
}

/* Change tag node color */
.tree-node[data-node-type="tag"] .tree-node-icon {
  color: var(--color-accent);
}

/* Adjust file count badge */
.tree-node-count {
  font-weight: bold;
  color: var(--text-accent);
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Build: `npm run build`
5. Watch mode: `npm run dev`

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built for [Obsidian](https://obsidian.md/)
- Inspired by the need for better tag organization in large vaults
- Thanks to the Obsidian community for feedback and support

## 📮 Support

- **Issues**: Report bugs or request features on [GitHub Issues](../../issues)
- **Discussions**: Ask questions on [GitHub Discussions](../../discussions)
- **Author**: [Fabian Kloosterman](https://github.com/fkloosterman)

## 🗺️ Roadmap

### Current Version (0.0.1)
- ✅ Nested tag hierarchy visualization
- ✅ Custom view configurations
- ✅ Collapsible tree UI with sorting
- ✅ Markdown codeblock rendering
- ✅ State persistence
- ✅ Keyboard navigation
- ✅ Performance optimizations

### Future Enhancements
- 🔄 Drag-and-drop tag assignment
- 🔄 Inline tag editing
- 🔄 Custom icons for tags and properties
- 🔄 Export tree structures
- 🔄 Search and filter within trees
- 🔄 Advanced sorting options (custom order, manual reordering)
- 🔄 Tree visualization themes

## 📊 Version History

### 0.0.1 (Current)
- Initial development release
- Core features implemented (Phases 1-5, partial 6-7)
- Full tag hierarchy support
- Custom view configurations
- Markdown codeblock embedding
- Keyboard navigation
- Performance optimizations

---

Made with ❤️ for the Obsidian community
