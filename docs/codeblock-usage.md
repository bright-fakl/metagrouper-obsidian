# Tag Tree Codeblock Usage Guide

## Overview

The Tag Tree plugin supports embedding tree views directly inside your notes using markdown codeblocks. This allows you to create custom, context-specific tag hierarchies that update automatically as your vault changes.

## Basic Syntax

To embed a tag tree in your note, use a `tagtree` codeblock:

````markdown
```tagtree
view: "View Name"
```
````

## Configuration Options

The codeblock supports several configuration options:

### Required Options

- **view**: The name of a saved view to render (must be configured in plugin settings)

### Optional Options

- **interactive**: Enable or disable interactivity (default: `true`)
  - `true`: Tree is fully interactive - nodes can be expanded/collapsed, files can be clicked to open
  - `false`: Tree is static - no hover effects or click handlers

- **format**: Choose the rendering format (default: `details`)
  - `details`: Uses the full TreeComponent with collapse icons and styling (recommended)
  - `list`: Simple nested list format with minimal styling

- **expanded**: Default expansion depth (default: `1`)
  - `0`: All nodes collapsed
  - `1`: Top level expanded
  - `2`: Top two levels expanded
  - etc.

- **showFiles**: Show or hide file nodes (default: `true`)
  - `true`: Display individual files in the tree
  - `false`: Only show tag/property groups, not individual files

## Examples

### Example 1: Basic Interactive Tree

````markdown
```tagtree
view: "All Tags"
```
````

This renders the "All Tags" view with default settings (interactive, details format, depth 1).

### Example 2: Non-Interactive Static Tree

````markdown
```tagtree
view: "Projects by Status"
interactive: false
```
````

This renders a non-interactive tree - useful for creating static snapshots in notes.

### Example 3: Expanded Tree with No Files

````markdown
```tagtree
view: "Research Topics"
expanded: 3
showFiles: false
```
````

This renders the tree expanded to 3 levels, showing only groups (no individual files).

### Example 4: Simple List Format

````markdown
```tagtree
view: "My Projects"
format: list
expanded: 2
```
````

This renders a simple nested list format, expanded to 2 levels.

### Example 5: Complete Configuration

````markdown
```tagtree
view: "Projects by Status"
interactive: true
format: details
expanded: 2
showFiles: true
```
````

This shows all available options with their default values.

## Use Cases

### 1. Project Dashboards

Create a project overview page with multiple embedded trees:

````markdown
# Project Dashboard

## Active Projects
```tagtree
view: "Projects by Status"
expanded: 1
```

## By Priority
```tagtree
view: "Projects by Priority"
expanded: 2
showFiles: false
```
````

### 2. Topic Overviews

Create topic-specific pages with filtered views:

````markdown
# Research: Machine Learning

```tagtree
view: "ML Research Topics"
expanded: 3
```
````

### 3. Static Documentation

Include non-interactive trees in documentation:

````markdown
# Tag Structure Documentation

Our vault uses the following tag hierarchy:

```tagtree
view: "All Tags"
interactive: false
format: list
expanded: 2
```
````

### 4. Meeting Notes

Embed relevant project trees in meeting notes:

````markdown
# Weekly Team Meeting - 2024-01-15

## Projects to Discuss

```tagtree
view: "Active Projects"
expanded: 1
showFiles: true
```
````

## Error Handling

If a view is not found or there's a configuration error, the codeblock will display an error message:

```
Tag Tree Error: View "Unknown View" not found. Available views: All Tags, Projects by Status
```

## Performance Considerations

- Each codeblock creates its own indexer instance, so having many codeblocks on one page may impact performance
- For better performance, consider:
  - Using `showFiles: false` to reduce the number of nodes
  - Limiting the `expanded` depth
  - Using the `list` format for simpler rendering

## Styling

The embedded trees inherit the plugin's CSS styling and support both light and dark themes. They are contained in a scrollable container with a maximum height of 600px (400px on mobile).

## Tips

1. **Create a "Views Index" Note**: Create a note that documents all your saved views and shows examples of each one
2. **Use Comments**: Add comments in your codeblocks for clarity:
   ````markdown
   ```tagtree
   # Show all active projects with files
   view: "Active Projects"
   showFiles: true
   ```
   ````
3. **Combine with Dataview**: Use codeblock trees alongside Dataview queries for powerful note organization
4. **Template Integration**: Include codeblocks in templates for consistent project/topic pages

## Troubleshooting

### "View not found" error
- Check that the view name exactly matches a saved view in the plugin settings
- View names are case-sensitive
- Make sure the view name is in quotes

### Tree not updating
- Codeblock trees update automatically when notes change
- If a tree seems stale, try switching to another note and back

### Tree is not interactive
- Check that `interactive: true` is set (or omit it for default)
- Make sure you're in Reading mode, not Edit mode

### Styling issues
- Check that the plugin's CSS is loaded
- Try switching themes to see if it's theme-specific
- Report styling bugs on the GitHub issues page
